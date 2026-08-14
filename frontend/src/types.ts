// Matches the Event struct in backend/events/event.go exactly
export interface RateLimitEvent {
  clientId: string;
  allowed: boolean;
  tokensRemaining: number;
  maxTokens: number;
  refillRate: number;
  timestamp: number; // UnixMilli
  latencyMs: number;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface ClientStats {
  clientId: string;
  tokensRemaining: number;
  maxTokens: number;
  refillRate: number;
  lastUpdated: number;
}

export const CLIENTS = ['client-a', 'client-b', 'client-c'] as const;
export type ClientId = typeof CLIENTS[number];

export const CLIENT_LABELS: Record<ClientId, string> = {
  'client-a': 'Client A',
  'client-b': 'Client B',
  'client-c': 'Client C',
};
