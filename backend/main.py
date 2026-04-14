from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List
import json
import logging
import traceback

from game.models import Card, Suit, Rank, GamePhase
from game.engine import GameEngine, GameError
from storage import GameStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Card Game API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for games and connections
games: Dict[str, GameEngine] = {}
store = GameStore()


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, game_id: str, websocket: WebSocket):
        await websocket.accept()
        if game_id not in self.active_connections:
            self.active_connections[game_id] = []
        self.active_connections[game_id].append(websocket)

    def disconnect(self, game_id: str, websocket: WebSocket):
        if game_id in self.active_connections:
            if websocket in self.active_connections[game_id]:
                self.active_connections[game_id].remove(websocket)
            if not self.active_connections[game_id]:
                del self.active_connections[game_id]

    async def broadcast(self, game_id: str, message: dict):
        if game_id not in self.active_connections:
            return

        disconnected = []
        for connection in self.active_connections[game_id]:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        # Clean up disconnected sockets
        for conn in disconnected:
            self.active_connections[game_id].remove(conn)


manager = ConnectionManager()


def normalize_game_id(game_id: str) -> str:
    """Normalize game IDs for case-insensitive lookups."""
    return game_id.strip().lower()


def load_engine_or_404(game_id: str) -> GameEngine:
    game_id = normalize_game_id(game_id)

    if game_id in games:
        return games[game_id]

    engine = store.load_engine(game_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Game not found")

    games[game_id] = engine
    return engine


def persist_engine(game_id: str, engine: GameEngine) -> None:
    games[game_id] = engine
    store.save_engine(game_id, engine)


@app.post("/games")
async def create_game():
    """Create a new game and return its ID."""
    engine = GameEngine()
    try:
        persist_engine(engine.state.id, engine)
    except Exception as exc:
        logger.exception("Failed to persist new game")
        raise HTTPException(status_code=500, detail="Failed to create game")

    return {
        "game_id": engine.state.id,
        "status": "created",
        "message": "Game created. Share this ID for others to join."
    }


@app.post("/games/{game_id}/join")
async def join_game(game_id: str, name: str):
    """Join an existing game."""
    game_id = normalize_game_id(game_id)
    engine = load_engine_or_404(game_id)

    if engine.state.phase != GamePhase.WAITING:
        raise HTTPException(status_code=400, detail="Game has already started")

    try:
        player = engine.add_player(name)
        persist_engine(game_id, engine)
        return {
            "player_id": player.id,
            "player_name": player.name,
            "game_id": game_id,
            "message": f"Joined game {game_id}"
        }
    except GameError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as exc:
        logger.exception("Failed to join game %s", game_id)
        raise HTTPException(status_code=500, detail="Server error while joining game")


@app.post("/games/{game_id}/start")
async def start_game(game_id: str):
    """Start the game."""
    game_id = normalize_game_id(game_id)
    engine = load_engine_or_404(game_id)

    try:
        engine.start_game()
        persist_engine(game_id, engine)

        # Notify all connected clients
        await manager.broadcast(game_id, {
            "type": "game_started",
            "data": {
                "starting_player_id": engine.state.starting_player_id,
                "message": "Game has started! Ace of Spades holder goes first."
            }
        })

        # Broadcast initial state
        await broadcast_game_state(game_id)

        return {
            "status": "started",
            "starting_player_id": engine.state.starting_player_id,
            "player_count": len(engine.state.players)
        }
    except GameError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as exc:
        logger.exception("Failed to start game %s", game_id)
        raise HTTPException(status_code=500, detail="Server error while starting game")


@app.get("/games/{game_id}/state")
async def get_game_state(game_id: str, player_id: str = None):
    """Get current game state."""
    game_id = normalize_game_id(game_id)
    engine = load_engine_or_404(game_id)

    if player_id:
        return engine.get_game_state_for_player(player_id)

    return engine.state.to_dict()


@app.post("/games/{game_id}/play")
async def play_card(game_id: str, player_id: str, suit: str, rank: str):
    """Play a card."""
    game_id = normalize_game_id(game_id)
    engine = load_engine_or_404(game_id)

    # Parse card
    try:
        card_suit = Suit(suit.lower())
        card_rank = Rank(rank.upper())
        card = Card(suit=card_suit, rank=card_rank)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid card")

    print(f"DEBUG: Player {player_id} playing {suit} {rank}")
    result = engine.play_card(player_id, card)
    print(f"DEBUG: Result for {player_id}: {result}")

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    persist_engine(game_id, engine)

    # Broadcast updated state
    await broadcast_game_state(game_id)

    # Handle pile completion
    if result.get("pile_complete"):
        pile_passed = result.get("pile_passed", False)
        winner_id = result.get("winner_id")
        message = "Pile passed! Everyone followed suit." if pile_passed else f"Player {winner_id} picks up the pile!"
        await manager.broadcast(game_id, {
            "type": "pile_complete",
            "data": {
                "winner_id": winner_id,
                "pile_passed": pile_passed,
                "message": message
            }
        })

    # Handle game over
    if result.get("game_over"):
        winner_id = engine.state.winner_id
        await manager.broadcast(game_id, {
            "type": "game_over",
            "data": {
                "winner_id": winner_id,
                "message": f"Player {winner_id} has won the game!"
            }
        })

    return result


async def broadcast_game_state(game_id: str):
    """Broadcast current game state to all connected clients."""
    engine = games.get(game_id)
    if not engine:
        engine = store.load_engine(game_id)
        if not engine:
            return
        games[game_id] = engine
    base_state = engine.state.to_dict()

    # Send personalized state to each connection
    if game_id in manager.active_connections:
        for websocket in manager.active_connections[game_id]:
            try:
                # Try to get player_id from query params (set during connection)
                player_id = getattr(websocket, 'player_id', None)
                if player_id:
                    state = engine.get_game_state_for_player(player_id)
                else:
                    state = base_state

                await websocket.send_json({
                    "type": "game_state",
                    "data": state
                })
            except Exception:
                pass


@app.websocket("/ws/{game_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: str):
    """WebSocket endpoint for real-time game updates."""
    game_id = normalize_game_id(game_id)
    try:
        engine = load_engine_or_404(game_id)
    except HTTPException:
        await websocket.close(code=4000, reason="Game not found")
        return

    await manager.connect(game_id, websocket)

    try:
        while True:
            # Receive messages from client
            data = await websocket.receive_text()
            message = json.loads(data)

            action = message.get("action")

            if action == "join":
                # Store player_id on websocket for personalized updates
                player_id = message.get("player_id")
                if player_id:
                    websocket.player_id = player_id
                    await websocket.send_json({
                        "type": "joined",
                        "data": {"player_id": player_id, "game_id": game_id}
                    })

            elif action == "play":
                # Handle play via WebSocket
                player_id = message.get("player_id")
                suit = message.get("suit")
                rank = message.get("rank")

                if not all([player_id, suit, rank]):
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": "Missing required fields"}
                    })
                    continue

                try:
                    card = Card(suit=Suit(suit.lower()), rank=Rank(rank.upper()))
                    print(f"DEBUG: WS Playing {suit} {rank} for {player_id}")
                    result = engine.play_card(player_id, card)
                    print(f"DEBUG: WS Result for {player_id}: {result}")

                    if result["success"]:
                        persist_engine(game_id, engine)
                        await broadcast_game_state(game_id)

                        if result.get("pile_complete"):
                            pile_passed = result.get("pile_passed", False)
                            winner_id = result.get("winner_id")
                            message = "Pile passed! Everyone followed suit." if pile_passed else f"Player {winner_id} picks up the pile!"
                            await manager.broadcast(game_id, {
                                "type": "pile_complete",
                                "data": {
                                    "winner_id": winner_id,
                                    "pile_passed": pile_passed,
                                    "message": message
                                }
                            })

                        if result.get("game_over"):
                            await manager.broadcast(game_id, {
                                "type": "game_over",
                                "data": {
                                    "winner_id": engine.state.winner_id,
                                    "message": f"Player {engine.state.winner_id} has won!"
                                }
                            })
                    else:
                        await websocket.send_json({
                            "type": "error",
                            "data": {"message": result["message"]}
                        })

                except Exception as e:
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": str(e)}
                    })

            elif action == "get_state":
                # Send current state
                player_id = getattr(websocket, 'player_id', None)
                if player_id:
                    state = engine.get_game_state_for_player(player_id)
                else:
                    state = engine.state.to_dict()

                await websocket.send_json({
                    "type": "game_state",
                    "data": state
                })

    except WebSocketDisconnect:
        manager.disconnect(game_id, websocket)
    except Exception:
        manager.disconnect(game_id, websocket)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "games_active": len(games), "store": "redis" if store._client else "memory"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
