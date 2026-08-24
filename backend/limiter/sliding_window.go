package limiter

import (
	"context"
	"fmt"
	"math/rand"
	"strconv"

	"github.com/redis/go-redis/v9"
)

// SlidingWindowLimiter implements a sliding window log rate limiter
// using a Redis sorted set to track request timestamps
type SlidingWindowLimiter struct {
	rdb               *redis.Client
	defaultMaxRequests int
	defaultWindowSec   int
	failOpen          bool
	script            *redis.Script
}

// SlidingWindowResult represents the result of a sliding window check
type SlidingWindowResult struct {
	Allowed        bool
	Remaining      int
	MaxRequests    int
	WindowSec      int
	CurrentCount   int
}

// NewSlidingWindowLimiter creates a new sliding window rate limiter
func NewSlidingWindowLimiter(rdb *redis.Client, defaultMaxRequests int, defaultWindowSec int, failOpen bool) *SlidingWindowLimiter {
	return &SlidingWindowLimiter{
		rdb:               rdb,
		defaultMaxRequests: defaultMaxRequests,
		defaultWindowSec:   defaultWindowSec,
		failOpen:          failOpen,
		script:            redis.NewScript(slidingWindowLua),
	}
}

// Check evaluates the rate limit for a client
// Returns allowed/remaining/max_requests/window_sec/current_count
func (l *SlidingWindowLimiter) Check(ctx context.Context, clientId string) (*SlidingWindowResult, error) {
	windowKey := fmt.Sprintf("ratelimit:sw:%s", clientId)
	clientConfigKey := fmt.Sprintf("ratelimit:sw:config:%s", clientId)
	defaultConfigKey := "ratelimit:sw:config:default"

	keys := []string{windowKey, clientConfigKey, defaultConfigKey}
	args := []interface{}{
		l.defaultMaxRequests,
		l.defaultWindowSec,
		1, // cost
	}

	// Add a random seed for uniqueness
	rand.Seed(0)

	res, err := l.script.Run(ctx, l.rdb, keys, args...).Result()
	if err != nil {
		if l.failOpen {
			return &SlidingWindowResult{
				Allowed:      true,
				Remaining:    l.defaultMaxRequests,
				MaxRequests:  l.defaultMaxRequests,
				WindowSec:    l.defaultWindowSec,
				CurrentCount: 0,
			}, nil
		}
		return nil, fmt.Errorf("redis error: %w", err)
	}

	slice, ok := res.([]interface{})
	if !ok || len(slice) < 5 {
		return nil, fmt.Errorf("unexpected script return format: %v", res)
	}

	allowedInt, ok1 := slice[0].(int64)
	remainingStr, ok2 := slice[1].(string)
	maxRequestsStr, ok3 := slice[2].(string)
	windowSecStr, ok4 := slice[3].(string)
	currentCountStr, ok5 := slice[4].(string)

	if !ok1 || !ok2 || !ok3 || !ok4 || !ok5 {
		return nil, fmt.Errorf("failed to cast script return types")
	}

	remaining, err := strconv.Atoi(remainingStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse remaining: %w", err)
	}

	maxRequests, err := strconv.Atoi(maxRequestsStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse maxRequests: %w", err)
	}

	windowSec, err := strconv.Atoi(windowSecStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse windowSec: %w", err)
	}

	currentCount, err := strconv.Atoi(currentCountStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse currentCount: %w", err)
	}

	return &SlidingWindowResult{
		Allowed:        allowedInt == 1,
		Remaining:      remaining,
		MaxRequests:    maxRequests,
		WindowSec:      windowSec,
		CurrentCount:   currentCount,
	}, nil
}

// SetConfig sets the sliding window configuration for a client
func (l *SlidingWindowLimiter) SetConfig(ctx context.Context, clientId string, maxRequests int, windowSec int) error {
	var key string
	if clientId == "" {
		key = "ratelimit:sw:config:default"
	} else {
		key = fmt.Sprintf("ratelimit:sw:config:%s", clientId)
	}

	err := l.rdb.HSet(ctx, key, map[string]interface{}{
		"max_requests": maxRequests,
		"window_sec":   windowSec,
	}).Err()
	if err != nil {
		return fmt.Errorf("failed to set sliding window config in Redis: %w", err)
	}

	return nil
}