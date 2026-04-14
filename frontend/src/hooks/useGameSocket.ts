import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketMessage } from '../types/game';
import { gameApi } from '../api/gameApi';
import { Card } from '../types/game';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}/_/backend`;
const WS_BASE = API_BASE_URL.replace(/^http/, 'ws').replace(/^https/, 'wss');
const CONNECTED_RESYNC_INTERVAL_MS = 2500;
const DISCONNECTED_POLL_INTERVAL_MS = 800;
const WS_ENABLED = import.meta.env.VITE_ENABLE_WS
  ? import.meta.env.VITE_ENABLE_WS !== 'false'
  : true;
const HEARTBEAT_INTERVAL_MS = 30000; // Send heartbeat every 30 seconds
const RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function useGameSocket(
  gameId: string | null,
  playerId: string | null,
  sessionToken: string | null,
  enableRealtime = true
) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRequestingStateRef = useRef(false);

  const fetchState = useCallback(async () => {
    if (!gameId || !playerId || !sessionToken) return;
    if (isRequestingStateRef.current) return;
    isRequestingStateRef.current = true;
    try {
      const state = await gameApi.getGameState(gameId, playerId, sessionToken);
      setLastMessage({ type: 'game_state', data: state });
      setIsConnected(true);
      setError(null);
    } catch (err) {
      setIsConnected(false);
      setError(err instanceof Error ? err.message : 'Failed to sync state');
    } finally {
      isRequestingStateRef.current = false;
    }
  }, [gameId, playerId, sessionToken]);

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
    if (!gameId || !playerId || !sessionToken || !WS_ENABLED || !enableRealtime) return;

    const ws = new WebSocket(`${WS_BASE}/ws/${gameId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);
      setReconnectAttempts(0);
      startHeartbeat();
      // Send join message
      ws.send(JSON.stringify({ action: 'join', player_id: playerId, session_token: sessionToken }));
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
  }, [enableRealtime, gameId, playerId, reconnectAttempts, sessionToken, startHeartbeat, stopHeartbeat]);

  useEffect(() => {
    if (!gameId || !playerId || !sessionToken) return;

    if (!WS_ENABLED || !enableRealtime) {
      setIsConnected(false);
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
  }, [enableRealtime, gameId, playerId, sessionToken, connectWebSocket, fetchState, stopHeartbeat]);

  useEffect(() => {
    if (!gameId || !playerId || !sessionToken) return;
    const timer = window.setInterval(() => {
      void fetchState();
    }, isConnected ? CONNECTED_RESYNC_INTERVAL_MS : DISCONNECTED_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [gameId, playerId, sessionToken, fetchState, isConnected]);

  const sendMessage = useCallback((action: string, data?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ action, player_id: playerId, session_token: sessionToken, ...data }));
        return true;
      } catch (err) {
        console.error('Failed to send WebSocket message:', err);
        setError('Failed to send message');
        return false;
      }
    } else {
      void fetchState();
      return false;
    }
  }, [fetchState, playerId, sessionToken]);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setReconnectAttempts(0);
    setError(null);
    connectWebSocket();
  }, [connectWebSocket]);

  const playCard = useCallback((suit: string, rank: string) => {
    if (!gameId || !playerId || !sessionToken) return;

    void gameApi
      .playCard(gameId, playerId, sessionToken, { suit, rank } as Card)
      .then(() => {
        setError(null);
        return fetchState();
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to play card');
        void fetchState();
      });
  }, [gameId, playerId, sessionToken, fetchState]);

  const getState = useCallback(() => {
    if (WS_ENABLED && enableRealtime && isConnected) {
      const success = sendMessage('get_state');
      if (success) {
        return;
      }
    }
    void fetchState();
  }, [enableRealtime, sendMessage, fetchState, isConnected]);

  return {
    isConnected,
    lastMessage,
    error,
    playCard,
    getState,
    reconnect
  };
}
