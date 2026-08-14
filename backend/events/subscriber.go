package events

import (
	"context"
	"encoding/json"
	"log"

	"github.com/redis/go-redis/v9"
)

const Channel = "bucketshield:ratelimit-events"

// Subscriber listens to the Redis Pub/Sub channel and fans out received
// messages to every WebSocket client connected to the Hub.
type Subscriber struct {
	rdb *redis.Client
	hub *Hub
}

// NewSubscriber creates a Subscriber that connects to rdb and broadcasts to hub.
func NewSubscriber(rdb *redis.Client, hub *Hub) *Subscriber {
	return &Subscriber{rdb: rdb, hub: hub}
}

// Run blocks, listening for messages on the Redis channel.
// It should be launched in a goroutine. It exits when ctx is cancelled.
func (s *Subscriber) Run(ctx context.Context) {
	pubsub := s.rdb.Subscribe(ctx, Channel)
	defer pubsub.Close()

	log.Printf("[Subscriber] Subscribed to Redis channel: %s", Channel)

	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			log.Printf("[Subscriber] Context cancelled, shutting down")
			return
		case msg, ok := <-ch:
			if !ok {
				log.Printf("[Subscriber] Redis channel closed")
				return
			}
			s.hub.Broadcast([]byte(msg.Payload))
		}
	}
}

// Publish sends an event payload to the Redis Pub/Sub channel so all backend
// instances can forward it to their WebSocket clients.
func Publish(ctx context.Context, rdb *redis.Client, event Event) {
	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("[Publish] Failed to marshal event: %v", err)
		return
	}
	if err := rdb.Publish(ctx, Channel, data).Err(); err != nil {
		log.Printf("[Publish] Failed to publish to Redis: %v", err)
	}
}
