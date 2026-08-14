package limiter

import (
	"encoding/json"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/akashwrites1120/bucketshield/backend/events"
	"github.com/redis/go-redis/v9"
)

// NewMiddleware returns a Chi-compatible rate-limiting middleware.
// After each decision it publishes an Event to Redis Pub/Sub so all backend
// instances can broadcast it to their connected WebSocket clients.
func NewMiddleware(l *Limiter, rdb *redis.Client) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			clientId := r.Header.Get("X-Client-ID")
			if clientId == "" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"error": "X-Client-ID header is required",
				})
				return
			}

			start := time.Now()
			res, err := l.Check(r.Context(), clientId, 1.0)
			latencyMs := float64(time.Since(start).Microseconds()) / 1000.0

			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"error": "Rate limit check failed",
				})
				return
			}

			// Publish to Redis Pub/Sub (non-blocking; errors are logged inside Publish)
			events.Publish(r.Context(), rdb, events.Event{
				ClientID:        clientId,
				Allowed:         res.Allowed,
				TokensRemaining: res.TokensRemaining,
				MaxTokens:       res.MaxTokens,
				RefillRate:      res.RefillRate,
				Timestamp:       time.Now().UnixMilli(),
				LatencyMs:       latencyMs,
			})

			w.Header().Set("X-RateLimit-Limit", strconv.FormatFloat(res.MaxTokens, 'f', 2, 64))
			w.Header().Set("X-RateLimit-Remaining", strconv.FormatFloat(res.TokensRemaining, 'f', 2, 64))

			if !res.Allowed {
				var retryAfter int
				if res.RefillRate > 0 {
					retryAfter = int(math.Ceil((1.0 - res.TokensRemaining) / res.RefillRate))
				}
				if retryAfter <= 0 {
					retryAfter = 1
				}

				w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				_ = json.NewEncoder(w).Encode(map[string]interface{}{
					"error":      "Too Many Requests",
					"retryAfter": retryAfter,
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
