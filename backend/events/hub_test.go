package events_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/akashwrites1120/bucketshield/backend/events"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// TestHubBroadcast verifies that a message published to the Hub reaches a
// connected WebSocket client.
func TestHubBroadcast(t *testing.T) {
	hub := events.NewHub()

	// Create a test HTTP server that acts as our /ws endpoint.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade error: %v", err)
			return
		}
		c := events.NewClient(hub, conn)
		hub.Register(c)

		// Drain inbound messages (client→server); not used in this test.
		go func() {
			for {
				if _, _, err := conn.ReadMessage(); err != nil {
					return
				}
			}
		}()
	}))
	defer server.Close()

	// Dial the test server as a WebSocket client.
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial error: %v", err)
	}
	defer conn.Close()

	// Give the server a moment to register the client.
	time.Sleep(50 * time.Millisecond)

	// Broadcast a rate-limit event.
	evt := events.Event{
		ClientID:        "test-client",
		Allowed:         true,
		TokensRemaining: 9.0,
		MaxTokens:       10.0,
		RefillRate:      2.0,
		Timestamp:       time.Now().UnixMilli(),
		LatencyMs:       1.23,
	}
	data, _ := json.Marshal(evt)
	hub.Broadcast(data)

	// Expect to receive the same payload within 1 second.
	conn.SetReadDeadline(time.Now().Add(1 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("ReadMessage error: %v", err)
	}

	var received events.Event
	if err := json.Unmarshal(msg, &received); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if received.ClientID != evt.ClientID {
		t.Errorf("expected clientId %q, got %q", evt.ClientID, received.ClientID)
	}
	if received.Allowed != evt.Allowed {
		t.Errorf("expected allowed=%v, got %v", evt.Allowed, received.Allowed)
	}
	if received.TokensRemaining != evt.TokensRemaining {
		t.Errorf("expected tokensRemaining=%.2f, got %.2f", evt.TokensRemaining, received.TokensRemaining)
	}
}

// TestSubscriberFanout verifies that an event published via events.Publish
// (simulated by directly calling hub.Broadcast) reaches multiple clients.
func TestHubMultiClientBroadcast(t *testing.T) {
	hub := events.NewHub()

	const numClients = 3

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		c := events.NewClient(hub, conn)
		hub.Register(c)
		go func() {
			for {
				if _, _, err := conn.ReadMessage(); err != nil {
					return
				}
			}
		}()
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	conns := make([]*websocket.Conn, numClients)
	for i := range conns {
		c, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		if err != nil {
			t.Fatalf("dial error for client %d: %v", i, err)
		}
		defer c.Close()
		conns[i] = c
	}

	time.Sleep(100 * time.Millisecond)

	evt := events.Event{ClientID: "broadcast-test", Allowed: false, Timestamp: time.Now().UnixMilli()}
	data, _ := json.Marshal(evt)
	hub.Broadcast(data)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	received := 0
	for _, c := range conns {
		c.SetReadDeadline(time.Now().Add(1 * time.Second))
		_, msg, err := c.ReadMessage()
		if err != nil {
			t.Errorf("ReadMessage error: %v", err)
			continue
		}
		var e events.Event
		_ = json.Unmarshal(msg, &e)
		if e.ClientID == "broadcast-test" {
			received++
		}
		_ = ctx
	}

	if received != numClients {
		t.Errorf("expected %d clients to receive the broadcast, got %d", numClients, received)
	}
}
