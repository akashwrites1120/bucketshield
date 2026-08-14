package events

import (
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

// Client represents a single WebSocket connection.
type Client struct {
	conn *websocket.Conn
	send chan []byte
}

// Hub maintains the set of active WebSocket clients and broadcasts messages to them.
type Hub struct {
	mu      sync.RWMutex
	clients map[*Client]struct{}
}

// NewHub creates an initialized Hub.
func NewHub() *Hub {
	return &Hub{
		clients: make(map[*Client]struct{}),
	}
}

// Register adds a new WebSocket client to the hub.
func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
	log.Printf("[Hub] Client registered. Total: %d", len(h.clients))
}

// Unregister removes a client from the hub and closes its send channel.
func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	if _, ok := h.clients[c]; ok {
		delete(h.clients, c)
		close(c.send)
	}
	h.mu.Unlock()
	log.Printf("[Hub] Client unregistered. Total: %d", len(h.clients))
}

// Broadcast sends a raw JSON message to every connected client.
func (h *Hub) Broadcast(msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		select {
		case c.send <- msg:
		default:
			// Slow consumer — skip rather than block the broadcaster
			log.Printf("[Hub] Slow consumer, skipping send")
		}
	}
}

// NewClient creates a Client and starts its write pump goroutine.
func NewClient(hub *Hub, conn *websocket.Conn) *Client {
	c := &Client{
		conn: conn,
		send: make(chan []byte, 64),
	}
	go c.writePump(hub)
	return c
}

// writePump drains the send channel and writes messages to the WebSocket.
func (c *Client) writePump(hub *Hub) {
	defer func() {
		hub.Unregister(c)
		c.conn.Close()
	}()

	for msg := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			log.Printf("[Hub] Write error: %v", err)
			return
		}
	}
}
