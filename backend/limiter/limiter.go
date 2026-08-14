package limiter

import (
	"context"
	"fmt"
	"log"
	"strconv"

	"github.com/redis/go-redis/v9"
)

type Limiter struct {
	rdb               *redis.Client
	defaultMaxTokens  float64
	defaultRefillRate float64
	failOpen          bool
	script            *redis.Script
}

type Result struct {
	Allowed         bool
	TokensRemaining float64
	MaxTokens       float64
	RefillRate      float64
}

func NewLimiter(rdb *redis.Client, defaultMaxTokens float64, defaultRefillRate float64, failOpen bool) *Limiter {
	return &Limiter{
		rdb:               rdb,
		defaultMaxTokens:  defaultMaxTokens,
		defaultRefillRate: defaultRefillRate,
		failOpen:          failOpen,
		script:            redis.NewScript(tokenBucketLua),
	}
}

// Check evaluates the rate limit for a client with a specific cost.
// To perform a status check without consuming tokens, pass cost = 0.
func (l *Limiter) Check(ctx context.Context, clientId string, cost float64) (*Result, error) {
	stateKey := fmt.Sprintf("ratelimit:state:%s", clientId)
	clientConfigKey := fmt.Sprintf("ratelimit:config:%s", clientId)
	defaultConfigKey := "ratelimit:config:default"

	keys := []string{stateKey, clientConfigKey, defaultConfigKey}
	args := []interface{}{
		l.defaultMaxTokens,
		l.defaultRefillRate,
		cost,
	}

	res, err := l.script.Run(ctx, l.rdb, keys, args...).Result()
	if err != nil {
		log.Printf("Rate limiter Redis connection error: %v", err)
		if l.failOpen {
			return &Result{
				Allowed:         true,
				TokensRemaining: l.defaultMaxTokens,
				MaxTokens:       l.defaultMaxTokens,
				RefillRate:      l.defaultRefillRate,
			}, nil
		}
		return nil, fmt.Errorf("redis error: %w", err)
	}

	slice, ok := res.([]interface{})
	if !ok || len(slice) < 4 {
		return nil, fmt.Errorf("unexpected script return format: %v", res)
	}

	allowedInt, ok1 := slice[0].(int64)
	tokensStr, ok2 := slice[1].(string)
	maxTokensStr, ok3 := slice[2].(string)
	refillRateStr, ok4 := slice[3].(string)

	if !ok1 || !ok2 || !ok3 || !ok4 {
		return nil, fmt.Errorf("failed to cast script return types")
	}

	tokensRemaining, err := strconv.ParseFloat(tokensStr, 64)
	if err != nil {
		return nil, fmt.Errorf("failed to parse tokens: %w", err)
	}

	maxTokens, err := strconv.ParseFloat(maxTokensStr, 64)
	if err != nil {
		return nil, fmt.Errorf("failed to parse maxTokens: %w", err)
	}

	refillRate, err := strconv.ParseFloat(refillRateStr, 64)
	if err != nil {
		return nil, fmt.Errorf("failed to parse refillRate: %w", err)
	}

	return &Result{
		Allowed:         allowedInt == 1,
		TokensRemaining: tokensRemaining,
		MaxTokens:       maxTokens,
		RefillRate:      refillRate,
	}, nil
}

func (l *Limiter) SetConfig(ctx context.Context, clientId string, maxTokens float64, refillRate float64) error {
	var key string
	if clientId == "" {
		key = "ratelimit:config:default"
	} else {
		key = fmt.Sprintf("ratelimit:config:%s", clientId)
	}

	err := l.rdb.HSet(ctx, key, map[string]interface{}{
		"max_tokens":  maxTokens,
		"refill_rate": refillRate,
	}).Err()
	if err != nil {
		return fmt.Errorf("failed to set rate limit config in Redis: %w", err)
	}

	return nil
}
