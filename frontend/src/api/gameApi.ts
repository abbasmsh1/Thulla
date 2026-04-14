import { Card } from '../types/game';

const API_BASE = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}/_/backend`;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

function createPlayerHeaders(sessionToken?: string) {
  return sessionToken ? { ...JSON_HEADERS, 'X-Player-Token': sessionToken } : JSON_HEADERS;
}

export const gameApi = {
  createGame: async (): Promise<{ game_id: string; status: string }> => {
    const response = await fetch(`${API_BASE}/games`, {
      method: 'POST',
      headers: JSON_HEADERS,
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('Failed to create game');
    return response.json();
  },

  joinGame: async (gameId: string, name: string): Promise<{ player_id: string; player_name: string; session_token: string }> => {
    const response = await fetch(`${API_BASE}/games/${gameId}/join?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: JSON_HEADERS,
      cache: 'no-store'
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to join game');
    }
    return response.json();
  },

  startGame: async (gameId: string, playerId: string, sessionToken: string): Promise<{ status: string; starting_player_id: string }> => {
    const response = await fetch(`${API_BASE}/games/${gameId}/start?player_id=${encodeURIComponent(playerId)}`, {
      method: 'POST',
      headers: createPlayerHeaders(sessionToken),
      cache: 'no-store'
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to start game');
    }
    return response.json();
  },

  getGameState: async (gameId: string, playerId?: string, sessionToken?: string): Promise<any> => {
    const url = playerId
      ? `${API_BASE}/games/${gameId}/state?player_id=${encodeURIComponent(playerId)}`
      : `${API_BASE}/games/${gameId}/state`;
    const response = await fetch(url, {
      headers: playerId ? createPlayerHeaders(sessionToken) : undefined,
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('Failed to get game state');
    return response.json();
  },

  playCard: async (gameId: string, playerId: string, sessionToken: string, card: Card): Promise<any> => {
    const response = await fetch(
      `${API_BASE}/games/${gameId}/play?player_id=${encodeURIComponent(playerId)}&suit=${encodeURIComponent(card.suit)}&rank=${encodeURIComponent(card.rank)}`,
      {
        method: 'POST',
        headers: createPlayerHeaders(sessionToken),
        cache: 'no-store'
      }
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to play card');
    }
    return response.json();
  }
};
