package limiter

import (
	"context"
	"math"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func assertAlmostEqual(t *testing.T, expected, actual, delta float64, msg string) {
	t.Helper()
	diff := math.Abs(expected - actual)
	if diff > delta {
		t.Errorf("%s: expected close to %f, got %f (difference %f, max allowed delta %f)", msg, expected, actual, diff, delta)
	}
}

func TestLimiter_Basic(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer mr.Close()

	rdb := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})
	defer rdb.Close()

	// Capacity: 3.0, Refill Rate: 10.0 tokens/second
	l := NewLimiter(rdb, 3.0, 10.0, false)
	ctx := context.Background()

	res, err := l.Check(ctx, "client-1", 1.0)
	if err != nil {
		t.Fatalf("check failed: %v", err)
	}
	if !res.Allowed {
		t.Error("expected first request to be allowed")
	}
	assertAlmostEqual(t, 2.0, res.TokensRemaining, 0.1, "expected 2.0 tokens remaining")

	res, err = l.Check(ctx, "client-1", 1.0)
	if err != nil {
		t.Fatalf("check failed: %v", err)
	}
	if !res.Allowed {
		t.Error("expected second request to be allowed")
	}
	assertAlmostEqual(t, 1.0, res.TokensRemaining, 0.1, "expected 1.0 tokens remaining")

	res, err = l.Check(ctx, "client-1", 1.0)
	if err != nil {
		t.Fatalf("check failed: %v", err)
	}
	if !res.Allowed {
		t.Error("expected third request to be allowed")
	}
	assertAlmostEqual(t, 0.0, res.TokensRemaining, 0.1, "expected 0.0 tokens remaining")

	res, err = l.Check(ctx, "client-1", 1.0)
	if err != nil {
		t.Fatalf("check failed: %v", err)
	}
	if res.Allowed {
		t.Error("expected fourth request to be rejected")
	}

	// Sleep for 100 milliseconds to refill approximately 1.0 token (0.1s * 10.0/s = 1.0 token)
	time.Sleep(105 * time.Millisecond)

	// Status check (cost = 0)
	res, err = l.Check(ctx, "client-1", 0.0)
	if err != nil {
		t.Fatalf("check failed: %v", err)
	}
	assertAlmostEqual(t, 1.0, res.TokensRemaining, 0.15, "expected ~1.0 tokens refilled")

	// Consume refilled token
	res, err = l.Check(ctx, "client-1", 1.0)
	if err != nil {
		t.Fatalf("check failed: %v", err)
	}
	if !res.Allowed {
		t.Error("expected request to be allowed after refill")
	}
}

func TestLimiter_DynamicConfig(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer mr.Close()

	rdb := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})
	defer rdb.Close()

	l := NewLimiter(rdb, 5.0, 1.0, false)
	ctx := context.Background()

	res, err := l.Check(ctx, "client-config", 0.0)
	if err != nil {
		t.Fatalf("check failed: %v", err)
	}
	if res.MaxTokens != 5.0 || res.RefillRate != 1.0 {
		t.Errorf("expected fallback config (5.0, 1.0), got (%f, %f)", res.MaxTokens, res.RefillRate)
	}

	err = l.SetConfig(ctx, "", 10.0, 2.0)
	if err != nil {
		t.Fatalf("set config failed: %v", err)
	}
	res, err = l.Check(ctx, "client-config", 0.0)
	if err != nil {
		t.Fatalf("check failed: %v", err)
	}
	if res.MaxTokens != 10.0 || res.RefillRate != 2.0 {
		t.Errorf("expected global default config (10.0, 2.0), got (%f, %f)", res.MaxTokens, res.RefillRate)
	}

	err = l.SetConfig(ctx, "client-config", 20.0, 4.0)
	if err != nil {
		t.Fatalf("set config failed: %v", err)
	}
	res, err = l.Check(ctx, "client-config", 0.0)
	if err != nil {
		t.Fatalf("check failed: %v", err)
	}
	if res.MaxTokens != 20.0 || res.RefillRate != 4.0 {
		t.Errorf("expected specific client config (20.0, 4.0), got (%f, %f)", res.MaxTokens, res.RefillRate)
	}

	res, err = l.Check(ctx, "other-client", 0.0)
	if err != nil {
		t.Fatalf("check failed: %v", err)
	}
	if res.MaxTokens != 10.0 || res.RefillRate != 2.0 {
		t.Errorf("expected other client to use global default config (10.0, 2.0), got (%f, %f)", res.MaxTokens, res.RefillRate)
	}
}

func TestLimiter_FailOpenClosed(t *testing.T) {
	// Use an invalid address to simulate a database connection outage
	rdb := redis.NewClient(&redis.Options{
		Addr: "localhost:9999",
	})
	defer rdb.Close()

	ctx := context.Background()

	t.Run("Fail Closed (Default)", func(t *testing.T) {
		l := NewLimiter(rdb, 10.0, 2.0, false)
		_, err := l.Check(ctx, "client-fail", 1.0)
		if err == nil {
			t.Error("expected error when Redis is down in fail-closed mode")
		}
	})

	t.Run("Fail Open", func(t *testing.T) {
		l := NewLimiter(rdb, 10.0, 2.0, true)
		res, err := l.Check(ctx, "client-fail", 1.0)
		if err != nil {
			t.Fatalf("expected no error when Redis is down in fail-open mode, got: %v", err)
		}
		if !res.Allowed {
			t.Error("expected request to be allowed in fail-open mode")
		}
		if res.MaxTokens != 10.0 || res.TokensRemaining != 10.0 {
			t.Errorf("expected default fallback tokens, got Max=%f, Remaining=%f", res.MaxTokens, res.TokensRemaining)
		}
	})
}

func TestLimiter_Concurrency(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	defer mr.Close()

	rdb := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})
	defer rdb.Close()

	l := NewLimiter(rdb, 10.0, 0.0, false)
	ctx := context.Background()

	const numWorkers = 50
	var wg sync.WaitGroup
	allowedCount := 0
	var mu sync.Mutex

	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			res, err := l.Check(ctx, "concurrent-client", 1.0)
			if err == nil && res.Allowed {
				mu.Lock()
				allowedCount++
				mu.Unlock()
			}
		}()
	}

	wg.Wait()

	if allowedCount != 10 {
		t.Errorf("expected exactly 10 requests to be allowed under concurrent burst, got %d", allowedCount)
	}
}
