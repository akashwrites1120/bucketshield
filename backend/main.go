package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/akashwrites1120/bucketshield/backend/events"
	"github.com/akashwrites1120/bucketshield/backend/limiter"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

// upgrader allows all origins for development; tighten for production.
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	defaultMaxTokens := 10.0
	if maxStr := os.Getenv("DEFAULT_MAX_TOKENS"); maxStr != "" {
		if val, err := strconv.ParseFloat(maxStr, 64); err == nil {
			defaultMaxTokens = val
		}
	}

	defaultRefillRate := 2.0
	if refillStr := os.Getenv("DEFAULT_REFILL_RATE"); refillStr != "" {
		if val, err := strconv.ParseFloat(refillStr, 64); err == nil {
			defaultRefillRate = val
		}
	}

	failOpen := false
	if failStr := os.Getenv("FAIL_OPEN"); failStr != "" {
		if val, err := strconv.ParseBool(failStr); err == nil {
			failOpen = val
		}
	}

	// Initialize Redis Client
	rdb := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	// Check Redis connectivity with a timeout
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Printf("Warning: Failed to connect to Redis at %s: %v", redisAddr, err)
		if !failOpen {
			log.Fatalf("Fatal: Redis connection required when FAIL_OPEN is false")
		}
	} else {
		log.Printf("Successfully connected to Redis at %s", redisAddr)
	}

	// Initialize Limiter
	limit := limiter.NewLimiter(rdb, defaultMaxTokens, defaultRefillRate, failOpen)

	// --- Phase 3: Real-Time Events ---
	// Create the WebSocket hub that tracks all connected clients.
	hub := events.NewHub()

	// Start the Redis Pub/Sub subscriber; it runs in the background and
	// fans every rate-limit event to this instance's connected WS clients.
	subCtx, subCancel := context.WithCancel(context.Background())
	defer subCancel()
	go events.NewSubscriber(rdb, hub).Run(subCtx)

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Unprotected health-check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// WebSocket endpoint — clients connect here to receive live rate-limit events.
	r.Get("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("[WS] Upgrade error: %v", err)
			return
		}

		c := events.NewClient(hub, conn)
		hub.Register(c)

		// Read pump: keep connection alive and detect client disconnects.
		// We discard any inbound messages; the WS channel is server→client only.
		go func() {
			defer hub.Unregister(c)
			for {
				if _, _, err := conn.ReadMessage(); err != nil {
					log.Printf("[WS] Read error (client disconnected): %v", err)
					return
				}
			}
		}()
	})

	// Config endpoint
	type ConfigPayload struct {
		ClientID   string  `json:"clientId"`
		MaxTokens  float64 `json:"maxTokens"`
		RefillRate float64 `json:"refillRate"`
	}

	r.Post("/api/config", func(w http.ResponseWriter, r *http.Request) {
		var payload ConfigPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "Invalid request body",
			})
			return
		}

		if payload.MaxTokens <= 0 || payload.RefillRate <= 0 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "maxTokens and refillRate must be greater than 0",
			})
			return
		}

		if err := limit.SetConfig(r.Context(), payload.ClientID, payload.MaxTokens, payload.RefillRate); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "Failed to update configuration",
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":     "success",
			"message":    "Configuration updated successfully",
			"clientId":   payload.ClientID,
			"maxTokens":  payload.MaxTokens,
			"refillRate": payload.RefillRate,
		})
	})

	// Status endpoint
	r.Get("/api/status/{clientId}", func(w http.ResponseWriter, r *http.Request) {
		clientId := chi.URLParam(r, "clientId")
		if clientId == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "clientId parameter is required",
			})
			return
		}

		res, err := limit.Check(r.Context(), clientId, 0.0) // 0 cost — status-only
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "Failed to fetch status",
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"clientId":   clientId,
			"tokens":     res.TokensRemaining,
			"maxTokens":  res.MaxTokens,
			"refillRate": res.RefillRate,
		})
	})

	// Rate-limited group — pass rdb so the middleware can publish events.
	r.Group(func(sr chi.Router) {
		sr.Use(limiter.NewMiddleware(limit, rdb))

		sr.Post("/api/protected", func(w http.ResponseWriter, r *http.Request) {
			clientId := r.Header.Get("X-Client-ID")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"status":   "success",
				"message":  "Access granted",
				"clientId": clientId,
			})
		})
	})

	log.Printf("Starting backend server on port %s...", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
