export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface Player {
  id: string;
  name: string;
  card_count: number;
  hand?: Card[];
}

export interface PlayedCard {
  card: Card;
  player_id: string;
}

export type GamePhase = 'waiting' | 'playing' | 'finished';

export interface GameState {
  id: string;
  players: Player[];
  current_player_id: string | null;
  pile: PlayedCard[];
  lead_suit: Suit | null;
  phase: GamePhase;
  winner_id: string | null;
  passed_pile_count: number;
}

export interface GameStateWithHand extends GameState {
  your_hand: Card[];
  your_id: string;
  valid_plays: Card[];
}

export interface WebSocketMessage {
  type: 'game_state' | 'game_started' | 'pile_complete' | 'game_over' | 'error' | 'joined' | 'reaction';
  data: any;
}

export interface EmojiReaction {
  id: string;
  emoji: string;
  player_id: string;
  timestamp: number;
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

export const SUIT_COLORS: Record<Suit, string> = {
  hearts: '#e74c3c',
  diamonds: '#e74c3c',
  clubs: '#2c3e50',
  spades: '#2c3e50'
};
