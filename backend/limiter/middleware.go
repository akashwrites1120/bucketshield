package limiter

import (
	"encoding/json"
	"math"
	"net/http"
	"strconv"
)

func NewMiddleware(l *Limiter) func(http.Handler) http.Handler {
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

			res, err := l.Check(r.Context(), clientId, 1.0)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"error": "Rate limit check failed",
				})
				return
			}

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
