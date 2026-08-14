package events

// Event is the payload broadcast to WebSocket clients for every rate-limit decision.
// Fields match the spec in status.md:
//
//	{clientId, allowed, tokensRemaining, maxTokens, timestamp, latencyMs}
type Event struct {
	ClientID        string  `json:"clientId"`
	Allowed         bool    `json:"allowed"`
	TokensRemaining float64 `json:"tokensRemaining"`
	MaxTokens       float64 `json:"maxTokens"`
	RefillRate      float64 `json:"refillRate"`
	// UnixMilli timestamp of the rate-limit decision (milliseconds).
	Timestamp int64 `json:"timestamp"`
	// LatencyMs is the round-trip time (ms) for the Redis Lua script call.
	LatencyMs float64 `json:"latencyMs"`
}
