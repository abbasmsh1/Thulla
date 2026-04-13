# Card Game Requirements Document

## 1. Overview

### 1.1 Purpose
This document outlines the requirements for a multiplayer card game web application.

### 1.2 Scope
The system will allow multiple players to join a game session, play a trick-taking card game in real-time, and track game state.

### 1.3 Definitions
- **Game Session**: An instance of a card game with one or more players
- **Trick**: A round where each player plays one card
- **Lead Suit**: The suit of the first card played in a trick
- **Pile**: The collection of cards played in the current trick

---

## 2. Functional Requirements

### 2.1 Game Management

| ID | Requirement | Priority |
|----|-------------|----------|
| GM-001 | Users can create a new game session | High |
| GM-002 | Users can join an existing game using a game ID | High |
| GM-003 | Game sessions support 2 to 14+ players | High |
| GM-004 | Game starts when minimum 2 players have joined | High |
| GM-005 | Only players in a session can play in that game | High |

### 2.2 Deck Management

| ID | Requirement | Priority |
|----|-------------|----------|
| DM-001 | Use 1 standard 52-card deck for 2-7 players | High |
| DM-002 | Use 2 decks (104 cards) for 8-14 players | High |
| DM-003 | Scale deck count automatically: `ceil(player_count / 7)` | High |
| DM-004 | Deck is shuffled before dealing | High |
| DM-005 | Cards are dealt as evenly as possible to all players | High |

### 2.3 Game Rules

| ID | Requirement | Priority |
|----|-------------|----------|
| GR-001 | The player holding the Ace of Spades starts the game | High |
| GR-002 | Play proceeds clockwise | High |
| GR-003 | On a player's turn, they must play one card | High |
| GR-004 | If player has cards matching the lead suit, they must play one | High |
| GR-005 | If player has no cards matching lead suit, they may play any card | High |
| GR-006 | After all players play, evaluate the trick | High |
| GR-007 | The highest card of the lead suit wins the trick | High |
| GR-008 | The winner picks up all cards from the pile | High |
| GR-009 | The winner leads the next trick | High |
| GR-010 | Card ranking (high to low): A, K, Q, J, 10-2 | High |
| GR-011 | First player to empty their hand wins the game | High |

### 2.4 Player Actions

| ID | Requirement | Priority |
|----|-------------|----------|
| PA-001 | Players can view their own hand | High |
| PA-002 | Players can see card counts for other players | High |
| PA-003 | Players can see the current pile of played cards | High |
| PA-004 | Players can see the current lead suit | High |
| PA-005 | Players can only play when it is their turn | High |
| PA-006 | System validates that played card follows game rules | High |

### 2.5 Game State Display

| ID | Requirement | Priority |
|----|-------------|----------|
| GD-001 | Display current player's turn | High |
| GD-002 | Display pile of played cards | High |
| GD-003 | Display lead suit indicator | High |
| GD-004 | Display each player's card count | High |
| GD-005 | Display game phase (waiting/playing/finished) | High |
| GD-006 | Display winner when game ends | High |

---

## 3. Non-Functional Requirements

### 3.1 Performance

| ID | Requirement | Priority |
|----|-------------|----------|
| NF-001 | Game state updates propagate to all players within 500ms | High |
| NF-002 | WebSocket connection stays active for game duration | High |
| NF-003 | Support for concurrent game sessions | Medium |

### 3.2 Usability

| ID | Requirement | Priority |
|----|-------------|----------|
| NF-004 | Game interface is responsive and works on desktop browsers | High |
| NF-005 | Valid cards are visually highlighted on player's turn | High |
| NF-006 | Card backs shown for other players' hands | High |
| NF-007 | Clear error messages for invalid actions | High |

### 3.3 Reliability

| ID | Requirement | Priority |
|----|-------------|----------|
| NF-008 | Game state persists for duration of session | High |
| NF-009 | Server handles disconnections gracefully | Medium |
| NF-010 | Game rules enforced server-side to prevent cheating | High |

---

## 4. Technical Requirements

### 4.1 Backend

| ID | Requirement | Priority |
|----|-------------|----------|
| TB-001 | Python 3.9+ runtime | High |
| TB-002 | FastAPI framework for REST endpoints | High |
| TB-003 | WebSocket support for real-time communication | High |
| TB-004 | Pydantic models for data validation | High |
| TB-005 | CORS enabled for frontend communication | High |

### 4.2 Frontend

| ID | Requirement | Priority |
|----|-------------|----------|
| TF-001 | React 18 with TypeScript | High |
| TF-002 | Vite as build tool | High |
| TF-003 | WebSocket client for real-time updates | High |
| TF-004 | Responsive card layout | High |

---

## 5. API Specification

### 5.1 REST Endpoints

```
POST   /games                    - Create new game
POST   /games/{id}/join         - Join game (query: name)
POST   /games/{id}/start        - Start game
POST   /games/{id}/play         - Play card (query: player_id, suit, rank)
GET    /games/{id}/state        - Get game state (query: player_id)
GET    /health                  - Health check
```

### 5.2 WebSocket Protocol

**Connection**: `ws://host:port/ws/{game_id}`

**Client → Server Messages**:
- `join`: `{action: "join", player_id: string}`
- `play`: `{action: "play", player_id: string, suit: string, rank: string}`
- `get_state`: `{action: "get_state"}`

**Server → Client Messages**:
- `game_state`: `{type: "game_state", data: GameState}`
- `game_started`: `{type: "game_started", data: {starting_player_id}}`
- `pile_complete`: `{type: "pile_complete", data: {winner_id}}`
- `game_over`: `{type: "game_over", data: {winner_id}}`
- `error`: `{type: "error", data: {message}}`

---

## 6. Data Models

### 6.1 Card
```typescript
{
  suit: "hearts" | "diamonds" | "clubs" | "spades",
  rank: "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A"
}
```

### 6.2 Player
```typescript
{
  id: string,
  name: string,
  card_count: number,
  hand?: Card[]  // Only visible to player themselves
}
```

### 6.3 Game State
```typescript
{
  id: string,
  players: Player[],
  current_player_id: string | null,
  pile: {card: Card, player_id: string}[],
  lead_suit: Suit | null,
  phase: "waiting" | "playing" | "finished",
  winner_id: string | null
}
```

---

## 7. Success Criteria

- [ ] Players can create and join games
- [ ] Game starts with correct player (Ace of Spades holder)
- [ ] Valid plays are enforced (following suit when possible)
- [ ] Trick winner is correctly determined
- [ ] Winner picks up pile and leads next trick
- [ ] Game ends when a player empties their hand
- [ ] Real-time updates reach all players within 500ms
- [ ] UI correctly displays game state and valid moves
