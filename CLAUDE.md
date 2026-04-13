# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multiplayer card game built with:
- **Frontend**: React + TypeScript (Vite)
- **Backend**: Python + FastAPI with WebSocket support

### Game Rules
- Deck is shuffled and dealt to all players
- If players > 7, use two decks (scales automatically)
- Player with Ace of Spades starts
- Each player plays one card of the same suit as the lead
- If no matching suit, can play any card
- Player with highest card of lead suit picks up the pile
- Goal: finish all cards first

## Common Commands

### Backend (Python/FastAPI)
```bash
cd backend
# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn main:app --reload

# Server runs on http://localhost:8000
```

### Frontend (React/TypeScript)
```bash
cd frontend
# Install dependencies
npm install

# Run development server
npm run dev

# Frontend runs on http://localhost:3000
```

## Project Structure

```
backend/
├── main.py              # FastAPI app, WebSocket handler
├── requirements.txt     # Python dependencies
└── game/
    ├── models.py        # Card, Player, GameState Pydantic models
    ├── deck.py          # Deck creation, shuffling, dealing
    └── engine.py        # Core game logic and rules

frontend/
├── src/
│   ├── components/      # React components
│   │   ├── Card.tsx     # Individual card display
│   │   ├── PlayerHand.tsx  # Player's hand of cards
│   │   ├── Opponent.tsx    # Opponent display
│   │   └── GameBoard.tsx   # Main game UI
│   ├── hooks/
│   │   └── useGameSocket.ts  # WebSocket connection hook
│   ├── api/
│   │   └── gameApi.ts    # HTTP API calls
│   ├── types/
│   │   └── game.ts       # TypeScript interfaces
│   └── App.tsx          # Main app component
└── package.json
```

## Architecture Notes

### Backend Game Logic (`backend/game/`)

**Deck Scaling**: `deck.py:calculate_deck_count()` returns `ceil(player_count / 7)` decks.

**Game Flow** (`engine.py`):
1. `start_game()` - shuffles, deals, finds Ace of Spades holder
2. `play_card()` - validates move, updates pile
3. When pile complete (all players played): `_evaluate_pile()` finds highest card of lead suit, winner picks up pile

**Valid Play Rules**: Must follow lead suit if possible; otherwise any card is valid.

**Card Ranking**: A (14), K (13), Q (12), J (11), 10-2 (descending).

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `game_state` | Server → Client | Full game state |
| `play_card` | Client → Server | `{suit, rank}` |
| `pile_complete` | Server → Client | Winner revealed |
| `game_over` | Server → Client | Winner announced |

### Frontend Components

**State Management**: Uses WebSocket for real-time updates; `useGameSocket` hook handles connection.

**Card Component**: Shows suit symbol (♥♦♣♠), rank, colored red for hearts/diamonds.

**Valid Play Highlighting**: Only current player's valid cards are clickable.

## API Endpoints

- `POST /games` - Create new game
- `POST /games/{id}/join?name={name}` - Join game
- `POST /games/{id}/start` - Start game
- `POST /games/{id}/play?player_id={id}&suit={s}&rank={r}` - Play card
- `GET /games/{id}/state?player_id={id}` - Get state
- `WS /ws/{game_id}` - WebSocket for real-time updates
