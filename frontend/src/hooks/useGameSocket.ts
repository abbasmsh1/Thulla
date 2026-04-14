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

export function useGameSocket(gameId: string | null, playerId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
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

  useEffect(() => {
    if (!gameId || !playerId) return;

    if (!WS_ENABLED) {
      setIsConnected(true);
      void fetchState();
      return;
    }

    const ws = new WebSocket(`${WS_BASE}/ws/${gameId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      // Send join message
      ws.send(JSON.stringify({ action: 'join', player_id: playerId }));
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
      setError('WebSocket error occurred');
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastMessage(message);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [gameId, playerId, fetchState]);

  useEffect(() => {
    if (!gameId || !playerId || WS_ENABLED) return;
    const timer = window.setInterval(() => {
      void fetchState();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [gameId, playerId, fetchState]);

  const sendMessage = useCallback((action: string, data?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action, player_id: playerId, ...data }));
    }
  }, [playerId]);

  const playCard = useCallback((suit: string, rank: string) => {
    if (!gameId || !playerId) return;
    if (WS_ENABLED) {
      sendMessage('play', { suit, rank });
      return;
    }

    void gameApi
      .playCard(gameId, playerId, { suit, rank } as Card)
      .then(() => fetchState())
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to play card');
      });
  }, [sendMessage, gameId, playerId, fetchState]);

  const getState = useCallback(() => {
    if (WS_ENABLED) {
      sendMessage('get_state');
      return;
    }
    void fetchState();
  }, [sendMessage, fetchState]);

  return {
    isConnected,
    lastMessage,
    error,
    playCard,
    getState
  };
}
