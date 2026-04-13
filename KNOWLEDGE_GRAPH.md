# Thulla - Project Knowledge Graph

## Overview

**Thulla** is a multiplayer card game built with a React/TypeScript frontend and Python/FastAPI backend with WebSocket support for real-time gameplay.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        React Frontend                            │    │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │    │
│  │  │   App.tsx   │──│ GameBoard.tsx│──│ PlayerHand.tsx       │   │    │
│  │  └──────┬──────┘  └──────────────┘  └──────────┬───────────┘   │    │
│  │         │                                      │                │    │
│  │  ┌──────▼──────┐  ┌──────────────┐  ┌──────────▼───────────┐   │    │
│  │  │useGameSocket│  │  Card.tsx    │──│ gameApi.ts (HTTP)    │   │    │
│  │  └──────┬──────┘  └──────────────┘  └──────────────────────┘   │    │
│  │         │                                                       │    │
│  └─────────┼───────────────────────────────────────────────────────┘    │
│            │ WebSocket (ws://localhost:8000/ws/{game_id})                │
└────────────┼─────────────────────────────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────────────────────────────┐
│                           SERVER LAYER                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    FastAPI Backend (main.py)                     │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │    │
│  │  │ConnectionManager│  │  Game Endpoints │  │  WebSocket     │  │    │
│  │  │                 │  │  /games/*       │  │  /ws/{game_id} │  │    │
│  │  └─────────────────┘  └─────────────────┘  └────────────────┘  │    │
│  └──────────┬─────────────────────┬────────────────────────────────┘    │
│             │                     │                                      │
│  ┌──────────▼─────────────────────▼────────────────────────────────┐    │
│  │                      Game Engine (game/)                         │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │    │
│  │  │  engine.py   │──│  models.py   │  │  deck.py             │  │    │
│  │  │  GameEngine  │  │  Card,Player │  │  Deck,shuffle,deal   │  │    │
│  │  │  play_card() │  │  GameState   │  │  calculate_deck_count│  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Backend Component Relationships

### `main.py` - FastAPI Application

```
main.py
├── ConnectionManager (class)
│   ├── connect(game_id, websocket)
│   ├── disconnect(game_id, websocket)
│   └── broadcast(game_id, message)
│
├── REST Endpoints
│   ├── POST /games              → create_game()
│   ├── POST /games/{id}/join    → join_game(name)
│   ├── POST /games/{id}/start   → start_game()
│   ├── GET  /games/{id}/state   → get_game_state(player_id)
│   └── POST /games/{id}/play    → play_card(suit, rank)
│
└── WebSocket Endpoint
    └── WS /ws/{game_id}
        ├── Action: "join"    → Store player_id
        ├── Action: "play"    → Call engine.play_card()
        └── Action: "get_state" → Return game state
```

### `game/engine.py` - GameEngine Class

```
GameEngine
├── state: GameState
├── deck: Optional[Deck]
│
├── add_player(name) → Player
├── remove_player(player_id) → bool
├── start_game() → GameState
│   ├── Creates Deck(player_count)
│   ├── deck.deal(players)
│   ├── Finds Ace of Spades holder
│   └── Sets starting_player_id
│
├── get_valid_plays(player_id) → List[Card]
│   ├── Rule 1: Force Ace of Spades on first turn
│   ├── Rule 2: Free lead if pile empty
│   ├── Rule 3: Must follow lead suit
│   └── Rule 4: Any card if no matching suit (Thulla)
│
├── play_card(player_id, card) → Dict
│   ├── Validates: game phase, turn, card ownership, valid play
│   ├── Removes card from hand
│   ├── Adds to pile
│   ├── Sets lead_suit on first card
│   ├── Detects Thulla (wrong suit played)
│   ├── Evaluates pile when complete
│   └── Checks for game over
│
├── _evaluate_pile() → Player
│   └── Finds highest card of lead suit
│
├── _check_winner() → bool
│   └── True if any player has 0 cards
│
└── get_game_state_for_player(player_id) → Dict
    └── Includes: your_hand, your_id, valid_plays
```

### `game/models.py` - Data Models

```
Suit (Enum)          Rank (Enum)           RANK_ORDER (Dict)
├── HEARTS           ├── TWO (2)           └── Maps Rank → numeric
├── DIAMONDS         ├── THREE (3)              (2-14)
├── CLUBS            ├── ...
└── SPADES           └── ACE (14)

Card (Pydantic)
├── suit: Suit
├── rank: Rank
├── is_ace_of_spades() → bool
└── to_dict() → Dict

Player (Pydantic)
├── id: str (UUID prefix)
├── name: str
├── hand: List[Card]
├── card_count → int
├── has_card(card) → bool
├── remove_card(card) → bool
├── add_cards(cards) → None
├── has_suit(suit) → bool
├── get_cards_of_suit(suit) → List[Card]
└── sort_hand() → None

GamePhase (Enum)
├── WAITING
├── PLAYING
└── FINISHED

PlayedCard (Pydantic)
├── card: Card
└── player_id: str

GameState (Pydantic)
├── id: str
├── players: List[Player]
├── current_player_index: int
├── pile: List[PlayedCard]
├── discarded_pile: List[PlayedCard]
├── lead_suit: Optional[Suit]
├── phase: GamePhase
├── winner_id: Optional[str]
├── starting_player_id: Optional[str]
├── passed_pile_count: int
├── current_player → Player (property)
├── get_player(player_id) → Optional[Player]
├── get_next_player_index() → int
├── advance_turn() → None
└── to_dict() → Dict
```

### `game/deck.py` - Deck Management

```
calculate_deck_count(player_count) → int
└── Returns: ceil(player_count / 7), min 1

Deck (class)
├── player_count: int
├── deck_count: int
├── cards: List[Card]
│
├── _create_deck() → None
│   └── Creates deck_count × 52 cards
│
├── shuffle() → None
├── deal(players) → Deck
├── find_ace_of_spades_holder(players) → Player
├── remaining() → int
├── draw() → Card
└── reset() → None
```

---

## Frontend Component Relationships

### `App.tsx` - Root Component

```
App
├── State
│   ├── gameId: string | null
│   ├── playerId: string | null
│   ├── playerName: string
│   ├── gameState: GameStateWithHand | null
│   ├── error: string | null
│   └── view: 'home' | 'create' | 'join' | 'lobby' | 'game'
│
├── Hooks
│   └── useGameSocket(gameId, playerId)
│       ├── isConnected: bool
│       ├── lastMessage: WebSocketMessage
│       ├── playCard(suit, rank)
│       └── getState()
│
├── API Calls (gameApi)
│   ├── createGame()
│   ├── joinGame(id, name)
│   ├── startGame(id)
│   └── playCard(gameId, playerId, card)
│
└── Renders
    ├── Home View (create/join buttons)
    ├── Join View (game ID + name input)
    ├── Create View (waiting with game code)
    ├── Lobby View (start game button)
    └── Game View → GameBoard
```

### `GameBoard.tsx` - Main Game UI

```
GameBoard
├── Props
│   ├── gameState: GameStateWithHand
│   ├── onPlayCard: (card) => void
│   └── reactions: EmojiReaction[]
│
├── Layout
│   ├── Header (Lead Suit indicator)
│   ├── Opponents (left, top, right positions)
│   ├── Center Pile Area
│   │   ├── Decorative plate
│   │   └── Played cards (fanned)
│   ├── Player Area (bottom)
│   │   ├── PlayerAvatar
│   │   └── PlayerHand
│   └── EmojiReactions (overlay)
│
├── Special States
│   ├── Pile Passed Banner
│   ├── Thulla Alert Banner
│   └── Game Over Screen (Victory/Defeat)
│
└── Sound Effects (useGameSounds)
    ├── playCardFlip() - on card played
    ├── playWinTrick() - on pile complete
    ├── playVictory() - on game over
    └── playShuffle() - on game start
```

### `PlayerHand.tsx` - Hand Display

```
PlayerHand
├── Props
│   ├── cards: CardType[]
│   ├── validPlays: CardType[]
│   ├── isCurrentPlayer: bool
│   └── onPlayCard: (card) => void
│
├── Features
│   ├── Arc layout calculation
│   │   ├── Max angle: min(20°, total × 1.8°)
│   │   ├── Vertical offset: |rotation| × 0.6
│   │   └── Spacing: max(25, min(50, 550/total))
│   │
│   ├── Valid play highlighting
│   │   ├── Gold dot indicator
│   │   ├── Expanding ring
│   │   └── Glow animation
│   │
│   └── Turn indicator banner
│
└── Renders
    └── Card[] (with position transforms)
```

### `Card.tsx` - Card Display

```
Card
├── Props
│   ├── card: Card
│   ├── isPlayable: bool
│   ├── isSelected: bool
│   ├── onClick: () => void
│   ├── hidden: bool
│   └── style: CSSProperties
│
├── Face-Down Design
│   ├── Gradient background
│   ├── Ornate border pattern (SVG)
│   └── Center spade emblem
│
└── Face-Up Design
    ├── Cream gradient background
    ├── Corner rank + suit (top-left, bottom-right)
    ├── Large center pip (SVG by suit)
    │   ├── Hearts: SVG heart path
    │   ├── Diamonds: SVG diamond path
    │   ├── Clubs: 3 circles + stem
    │   └── Spades: SVG spade path
    │
    ├── Gold corner decorations
    ├── Gloss sheen overlay
    ├── Playable highlight border
    └── Hover/lift animation
```

---

## Data Flow

### Game Creation Flow

```
User clicks "Create Game"
    ↓
App.handleCreateGame()
    ↓
gameApi.createGame() → POST /games
    ↓
main.create_game()
    ↓
GameEngine created → games[game_id]
    ↓
Returns { game_id, status }
    ↓
App sets view='create', shows game code
```

### Join Game Flow

```
User enters game ID + name → clicks "Enter Arena"
    ↓
App.handleJoinGame()
    ↓
gameApi.joinGame(gameId, name) → POST /games/{id}/join?name=X
    ↓
main.join_game()
    ↓
GameEngine.add_player(name) → Player
    ↓
Returns { player_id, player_name }
    ↓
App sets view='lobby'
    ↓
useGameSocket connects WS → /ws/{game_id}
    ↓
WS sends { action: "join", player_id }
```

### Game Start Flow

```
Host clicks "Deal Cards"
    ↓
App.handleStartGame()
    ↓
gameApi.startGame(gameId) → POST /games/{id}/start
    ↓
main.start_game()
    ↓
GameEngine.start_game()
    ├── Deck(player_count) created
    ├── deck.deal(players)
    ├── find_ace_of_spades_holder()
    └── phase = PLAYING
    ↓
WS broadcast: { type: "game_started" }
    ↓
WS broadcast: { type: "game_state", data: {...} }
    ↓
GameBoard renders playing state
```

### Play Card Flow

```
User clicks valid card
    ↓
PlayerHand → onPlayCard(card)
    ↓
App.handlePlayCard(card)
    ↓
playCard(suit, rank) via WebSocket
    ↓
WS receives { action: "play", suit, rank, player_id }
    ↓
GameEngine.play_card(player_id, card)
    ├── Validates: turn, card ownership, valid play
    ├── Removes card from hand
    ├── Adds to pile
    ├── Sets lead_suit
    ├── Checks for Thulla or pile complete
    ├── _evaluate_pile() if complete
    └── _check_winner()
    ↓
WS broadcast: { type: "game_state" }
    ↓
All clients update gameState
```

---

## Game Rules Encoded

### Deck Scaling
- **Formula**: `ceil(player_count / 7)` decks
- **Example**: 8 players = 2 decks, 14 players = 2 decks, 15 players = 3 decks

### Turn Order
1. Player with **Ace of Spades** starts (found after deal)
2. Play proceeds clockwise (index + 1 mod player_count)
3. Winner of each trick leads next

### Valid Play Rules
1. **First turn of game**: Must play Ace of Spades
2. **Empty pile (new trick)**: Any card (free lead)
3. **Pile has cards**: Must follow lead suit if possible
4. **No matching suit**: Any card valid (this is a "Thulla")

### Trick Resolution
- **All followed suit**: "Passed Pile" - highest card of lead suit wins, pile discarded
- **Thulla played** (wrong suit): Game may end, highest card of lead suit picks up pile

### Winning Condition
- First player to empty their hand wins

---

## WebSocket Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `join` | Client→Server | `{ player_id }` | Client identifies itself |
| `play` | Client→Server | `{ suit, rank, player_id }` | Play a card |
| `get_state` | Client→Server | - | Request current state |
| `game_state` | Server→Client | `GameStateWithHand` | Full game state update |
| `game_started` | Server→Client | `{ starting_player_id }` | Game has begun |
| `pile_complete` | Server→Client | `{ winner_id, pile_passed }` | Trick resolved |
| `game_over` | Server→Client | `{ winner_id }` | Game ended |
| `error` | Server→Client | `{ message }` | Error occurred |
| `reaction` | Server→Client | `{ emoji, player_id }` | Emoji reaction |

---

## Type Mappings

### Backend (Python) → Frontend (TypeScript)

```
Python              TypeScript
─────────────────────────────────────────────
Suit.HEARTS    →    'hearts'
Suit.DIAMONDS  →    'diamonds'
Suit.CLUBS     →    'clubs'
Suit.SPADES    →    'spades'

Rank.TWO       →    '2'
Rank.ACE       →    'A'

Card.to_dict() →    { suit: string, rank: string }
GameState      →    GameStateWithHand (extended)
```

---

## File Dependencies

```
backend/
├── main.py
│   ├── game/models.py (Card, Suit, Rank, GamePhase)
│   └── game/engine.py (GameEngine, GameError)
│
├── game/
│   ├── engine.py
│   │   ├── models.py (Card, Player, GameState, PlayedCard, Suit, RANK_ORDER)
│   │   └── deck.py (Deck)
│   │
│   ├── models.py (no internal deps)
│   └── deck.py
│       └── models.py (Card, Suit, Rank, Player)
│
└── requirements.txt (dependencies: fastapi, uvicorn, pydantic, websockets)

frontend/
├── src/
│   ├── App.tsx
│   │   ├── api/gameApi.ts
│   │   ├── hooks/useGameSocket.ts
│   │   ├── components/GameBoard.tsx
│   │   └── types/game.ts
│   │
│   ├── components/
│   │   ├── GameBoard.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── PlayerHand.tsx
│   │   │   ├── PlayerAvatar.tsx
│   │   │   └── EmojiReactions.tsx
│   │   │
│   │   ├── PlayerHand.tsx
│   │   │   └── Card.tsx
│   │   │
│   │   ├── Card.tsx
│   │   │   └── types/game.ts (SUIT_SYMBOLS, SUIT_COLORS)
│   │   │
│   │   ├── PlayerAvatar.tsx (no internal deps)
│   │   └── EmojiReactions.tsx (no internal deps)
│   │
│   ├── hooks/
│   │   ├── useGameSocket.ts
│   │   │   └── types/game.ts (WebSocketMessage)
│   │   │
│   │   └── useGameSounds.ts (external audio files)
│   │
│   ├── api/
│   │   └── gameApi.ts
│   │       └── types/game.ts (Card)
│   │
│   └── types/
│       └── game.ts (no deps - base types)
│
└── package.json (dependencies: react, react-dom)
```

---

## Key Design Decisions

1. **Pydantic Models**: Used for data validation and serialization in backend
2. **UUID Prefixes**: Player/Game IDs use 8-char UUID prefix for brevity
3. **WebSocket-First**: Real-time updates via WS, HTTP for initial actions
4. **Client-Side Validation**: Frontend highlights valid plays before server validation
5. **Personalized State**: Server sends full hand only to owning player
6. **Deck Scaling**: Automatic deck multiplication for large player counts
7. **Lead Suit Tracking**: Stored on GameState, used for valid play enforcement
8. **Thulla Mechanic**: Special handling when player cannot/won't follow suit

---

## External Dependencies

### Backend
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `pydantic` - Data validation
- `websockets` - WebSocket support

### Frontend
- `react` ^18.2.0 - UI framework
- `react-dom` ^18.2.0 - React DOM renderer
- `typescript` ^5.2.2 - Type safety
- `vite` ^5.0.8 - Build tool

### Services
- `api.dicebear.com` - Avatar generation (pixel-art style)

---

## Configuration

### Backend (main.py)
- **CORS**: Allows all origins (`allow_origins=["*"]`)
- **Server**: Runs on `http://localhost:8000`
- **In-Memory Storage**: `games: Dict[str, GameEngine]`

### Frontend
- **API Base**: `http://localhost:8000`
- **WebSocket**: `ws://localhost:8000`
- **Dev Server**: Vite on `http://localhost:3000`

---

## Testing Entry Points

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Extension Points

1. **Authentication**: Add player sessions, game passwords
2. **Persistence**: Database for game history, player stats
3. **AI Opponents**: Bot players for single-player mode
4. **Custom Rules**: Configurable deck count, winning conditions
5. **Spectator Mode**: Read-only WebSocket connections
6. **Tournament Mode**: Bracket management, multiple concurrent games
