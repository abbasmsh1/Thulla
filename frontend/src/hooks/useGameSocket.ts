import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketMessage } from '../types/game';
import { gameApi } from '../api/gameApi';
import { Card } from '../types/game';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}/_/backend`;
const WS_BASE = API_BASE_URL.replace(/^http/, 'ws').replace(/^https/, 'wss');
const POLL_INTERVAL_MS = 1200;
const WS_ENABLED = import.meta.env.VITE_ENABLE_WS
  ? import.meta.env.VITE_ENABLE_WS === 'true'
  : import.meta.env.DEV;
const HEARTBEAT_INTERVAL_MS = 30000; // Send heartbeat every 30 seconds
const RECONNECT_DELAY_MS = 2000; // Wait 2 seconds before reconnecting
const MAX_RECONNECT_ATTEMPTS = 5;

export function useGameSocket(gameId: string | null, playerId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRequestingStateRef = useRef(false);

  const fetchState = useCallback(async () => {
    if (!gameId || !playerId) return;
    if (isRequestingStateRef.current) return;
    isRequestingStateRef.current = true;
    try {
      const state = await gameApi.getGameState(gameId, playerId);
      setLastMessage({ type: 'game_state', data: state });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync state');
    } finally {
      isRequestingStateRef.current = false;
    }
  }, [gameId, playerId]);

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    heartbeatRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'heartbeat' }));
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (!gameId || !playerId || !WS_ENABLED) return;

    const ws = new WebSocket(`${WS_BASE}/ws/${gameId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);
      setReconnectAttempts(0);
      startHeartbeat();
      // Send join message
      ws.send(JSON.stringify({ action: 'join', player_id: playerId }));
    };

    ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      setIsConnected(false);
      stopHeartbeat();

      // Attempt reconnection if not a clean close and under max attempts
      if (!event.wasClean && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        setReconnectAttempts(prev => prev + 1);
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`Attempting to reconnect (${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
          connectWebSocket();
        }, RECONNECT_DELAY_MS);
      } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        setError('Connection lost. Please refresh the page to reconnect.');
      }
    };

    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      setError('WebSocket connection error');
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastMessage(message);

        // Reset reconnect attempts on successful message
        if (reconnectAttempts > 0) {
          setReconnectAttempts(0);
        }
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };
  }, [gameId, playerId, reconnectAttempts, startHeartbeat, stopHeartbeat]);

  useEffect(() => {
    if (!gameId || !playerId) return;

    if (!WS_ENABLED) {
      setIsConnected(true);
      void fetchState();
      return;
    }

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      stopHeartbeat();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [gameId, playerId, connectWebSocket, fetchState, stopHeartbeat]);

  useEffect(() => {
    if (!gameId || !playerId || WS_ENABLED) return;
    const timer = window.setInterval(() => {
      void fetchState();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [gameId, playerId, fetchState]);

  const sendMessage = useCallback((action: string, data?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ action, player_id: playerId, ...data }));
        return true;
      } catch (err) {
        console.error('Failed to send WebSocket message:', err);
        setError('Failed to send message');
        return false;
      }
    } else {
      console.warn('WebSocket not connected, cannot send message');
      return false;
    }
  }, [playerId]);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setReconnectAttempts(0);
    setError(null);
    connectWebSocket();
  }, [connectWebSocket]);

  const playCard = useCallback((suit: string, rank: string) => {
    if (!gameId || !playerId) return;

    if (WS_ENABLED && isConnected) {
      const success = sendMessage('play', { suit, rank });
      if (!success) {
        // Fallback to HTTP if WebSocket fails
        void gameApi
          .playCard(gameId, playerId, { suit, rank } as Card)
          .then(() => fetchState())
          .catch((err) => {
            setError(err instanceof Error ? err.message : 'Failed to play card');
          });
      }
      return;
    }

    // HTTP fallback
    void gameApi
      .playCard(gameId, playerId, { suit, rank } as Card)
      .then(() => fetchState())
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to play card');
      });
  }, [sendMessage, gameId, playerId, fetchState, isConnected]);

  const getState = useCallback(() => {
    if (WS_ENABLED && isConnected) {
      sendMessage('get_state');
      return;
    }
    void fetchState();
  }, [sendMessage, fetchState, isConnected]);

  return {
    isConnected,
    lastMessage,
    error,
    playCard,
    getState,
    reconnect
  };
}
