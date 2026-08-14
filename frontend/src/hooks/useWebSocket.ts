import { useEffect, useRef, useState, useCallback } from 'react';
import type { RateLimitEvent, ConnectionStatus } from '../types';

const INITIAL_RETRY_MS = 500;
const MAX_RETRY_MS = 16_000;
const MAX_EVENTS = 200; // internal ring buffer size

interface UseWebSocketReturn {
  events: RateLimitEvent[];
  status: ConnectionStatus;
}

/**
 * Opens a WebSocket connection to the given URL with automatic
 * exponential-backoff reconnect on disconnect or error.
 * Returns a live-updating array of recent events (capped at MAX_EVENTS).
 */
export function useWebSocket(url: string): UseWebSocketReturn {
  const [events, setEvents] = useState<RateLimitEvent[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const retryMs = useRef(INITIAL_RETRY_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);

  const connect = useCallback(() => {
    if (unmounted.current) return;

    setStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmounted.current) { ws.close(); return; }
      setStatus('connected');
      retryMs.current = INITIAL_RETRY_MS; // reset backoff on successful connect
    };

    ws.onmessage = (e) => {
      if (unmounted.current) return;
      try {
        const event: RateLimitEvent = JSON.parse(e.data);
        setEvents((prev) => {
          const next = [event, ...prev];
          return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
        });
      } catch {
        // malformed message — ignore
      }
    };

    ws.onerror = () => {
      if (unmounted.current) return;
      setStatus('error');
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      setStatus('disconnected');
      wsRef.current = null;
      // Schedule reconnect with exponential backoff
      const delay = retryMs.current;
      retryMs.current = Math.min(retryMs.current * 2, MAX_RETRY_MS);
      timerRef.current = setTimeout(connect, delay);
    };
  }, [url]);

  useEffect(() => {
    unmounted.current = false;
    connect();

    return () => {
      unmounted.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { events, status };
}
