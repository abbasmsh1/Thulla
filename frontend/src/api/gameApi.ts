import { Card } from '../types/game';

const API_BASE = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}/_/backend`;

export const gameApi = {
  createGame: async (): Promise<{ game_id: string; status: string }> => {
    const response = await fetch(`${API_BASE}/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('Failed to create game');
    return response.json();
  },

  joinGame: async (gameId: string, name: string): Promise<{ player_id: string; player_name: string }> => {
    const response = await fetch(`${API_BASE}/games/${gameId}/join?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to join game');
    }
    return response.json();
  },

  startGame: async (gameId: string): Promise<{ status: string; starting_player_id: string }> => {
    const response = await fetch(`${API_BASE}/games/${gameId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to start game');
    }
    return response.json();
  },

  getGameState: async (gameId: string, playerId?: string): Promise<any> => {
    const url = playerId
      ? `${API_BASE}/games/${gameId}/state?player_id=${playerId}`
      : `${API_BASE}/games/${gameId}/state`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to get game state');
    return response.json();
  },

  playCard: async (gameId: string, playerId: string, card: Card): Promise<any> => {
    const response = await fetch(
      `${API_BASE}/games/${gameId}/play?player_id=${playerId}&suit=${card.suit}&rank=${card.rank}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to play card');
    }
    return response.json();
  }
};
