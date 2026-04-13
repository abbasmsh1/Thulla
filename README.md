# Card Game

A multiplayer card game built with React + TypeScript frontend and Python + FastAPI backend.

## Game Rules

This is a trick-taking card game where the goal is to empty your hand first.

### Setup
- The deck is shuffled and dealt evenly to all players
- **1 deck** is used for 2-7 players
- **2 decks** are used for 8-14 players (scales automatically)
- The player with the **Ace of Spades** goes first

### Gameplay
1. The starting player leads with any card - this sets the **lead suit**
2. Each player in turn must play **one card of the lead suit** if they have one
3. If a player has no cards of the lead suit, they may play **any card**
4. Once all players have played, the player with the **highest card of the lead suit** wins the trick
5. The winner picks up all cards from the pile and leads the next round
6. The first player to empty their hand **wins the game**

### Card Rankings (high to low)
A, K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3, 2

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18, TypeScript, Vite |
| Backend | Python 3.9+, FastAPI, WebSockets |
| Communication | REST API + WebSocket for real-time updates |

## Quick Start

### Prerequisites
- Python 3.9 or higher
- Node.js 18 or higher
- npm or yarn

### Running the Backend

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload

# Server will be available at http://localhost:8000
```

### Running the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Frontend will be available at http://localhost:3000
```

### Playing the Game

1. Open http://localhost:3000 in your browser
2. Click "Create New Game" to generate a game ID
3. Share the game ID with friends
4. Each player enters their name and joins with the game ID
5. Once at least 2 players have joined, anyone can click "Start Game"
6. Play begins automatically with the Ace of Spades holder

## Project Structure

```
.
├── backend/              # Python FastAPI backend
│   ├── game/
│   │   ├── models.py     # Card, Player, GameState models
│   │   ├── deck.py       # Deck management
│   │   └── engine.py     # Game logic
│   ├── main.py           # FastAPI app and WebSocket handler
│   └── requirements.txt  # Python dependencies
│
├── frontend/             # React TypeScript frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── api/            # API client
│   │   └── types/          # TypeScript interfaces
│   ├── package.json
│   └── vite.config.ts
│
└── CLAUDE.md            # Developer guide for Claude Code
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/games` | Create a new game |
| POST | `/games/{id}/join` | Join an existing game |
| POST | `/games/{id}/start` | Start the game |
| POST | `/games/{id}/play` | Play a card |
| GET | `/games/{id}/state` | Get current game state |
| WS | `/ws/{game_id}` | WebSocket for real-time updates |

## Development

### Backend Testing

```bash
cd backend

# Run with auto-reload
uvicorn main:app --reload

# View API documentation
# OpenAPI/Swagger: http://localhost:8000/docs
# ReDoc: http://localhost:8000/redoc
```

### Frontend Development

```bash
cd frontend

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deploy on Vercel

This repo is configured for a single Vercel project:
- Frontend (Vite static build) from `frontend/`
- Backend (FastAPI serverless function) at `api/index.py`

### Important note about real-time mode

Vercel serverless functions do not provide stable WebSocket connections for this game flow.
For production deploys on Vercel, the frontend automatically falls back to HTTP state sync/polling.

### Deploy steps

1. Push this repository to GitHub.
2. In Vercel, import the repo as a new project.
3. Keep the default root (repository root), because `vercel.json` handles both builds.
4. Deploy.

### Environment variables (optional)

- `VITE_API_BASE_URL` (frontend): defaults to `/api`
- `VITE_ENABLE_WS` (frontend):
  - dev default is `true`
  - production default is `false` (HTTP polling fallback)

## Features

### Core Gameplay
- ✅ Real-time multiplayer gameplay via WebSocket
- ✅ Automatic deck scaling based on player count
- ✅ Interactive card playing with valid move highlighting
- ✅ Visual pile display showing played cards
- ✅ Opponent displays with card counts
- ✅ Game state synchronization across all players
- ✅ Responsive card layout
- ✅ Game over detection and winner announcement

### Visual Design
- 🎨 Elegant casino-style dark theme with felt table
- 🎴 Realistic card designs with proper suit symbols
- 👤 Unique pixel-art avatars for each player (dicebear API)
- ✨ Smooth animations (card hover, play, dealing)
- 🎯 Visual turn indicators and valid play hints

### Audio & Interaction
- 🔊 Sound effects (card flip, shuffle, trick win, victory)
- 😄 Emoji reactions (send floating emojis during gameplay)
- 📊 Live game statistics (cards played, tricks won, totals)
- 🎵 Web Audio API for synthesized sounds (no external files needed)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

MIT
