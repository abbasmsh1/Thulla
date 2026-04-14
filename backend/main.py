import os
import re
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional
import json
import logging
import traceback
import time
import asyncio

from game.models import Card, Suit, Rank, GamePhase
from game.engine import GameEngine, GameError
from storage import GameStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Card Game API")

DEFAULT_ALLOWED_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://.*\.vercel\.app$"
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip()]
ALLOWED_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX", DEFAULT_ALLOWED_ORIGIN_REGEX)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS or [],
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Player-Token"],
)

# In-memory storage for games and connections
games: Dict[str, GameEngine] = {}
store = GameStore()
WAITING_ROOM_DISCONNECT_TIMEOUT_SECONDS = 1800
IN_GAME_DISCONNECT_TIMEOUT_SECONDS = 30


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.connection_timestamps: Dict[str, Dict[WebSocket, float]] = {}
        self.socket_players: Dict[str, Dict[WebSocket, str]] = {}
        self.player_connections: Dict[str, Dict[str, set[WebSocket]]] = {}

    async def connect(self, game_id: str, websocket: WebSocket):
        await websocket.accept()
        if game_id not in self.active_connections:
            self.active_connections[game_id] = []
            self.connection_timestamps[game_id] = {}
            self.socket_players[game_id] = {}
            self.player_connections[game_id] = {}
        self.active_connections[game_id].append(websocket)
        self.connection_timestamps[game_id][websocket] = time.time()

    def assign_player(self, game_id: str, websocket: WebSocket, player_id: str):
        if game_id not in self.socket_players:
            self.socket_players[game_id] = {}
        if game_id not in self.player_connections:
            self.player_connections[game_id] = {}

        previous_player_id = self.socket_players[game_id].get(websocket)
        if previous_player_id and previous_player_id in self.player_connections[game_id]:
            self.player_connections[game_id][previous_player_id].discard(websocket)
            if not self.player_connections[game_id][previous_player_id]:
                del self.player_connections[game_id][previous_player_id]

        self.socket_players[game_id][websocket] = player_id
        self.player_connections[game_id].setdefault(player_id, set()).add(websocket)

    def disconnect(self, game_id: str, websocket: WebSocket) -> Optional[str]:
        disconnected_player_id = None
        player_still_connected = False
        if game_id in self.active_connections:
            if websocket in self.active_connections[game_id]:
                self.active_connections[game_id].remove(websocket)
                if websocket in self.connection_timestamps.get(game_id, {}):
                    del self.connection_timestamps[game_id][websocket]
            if websocket in self.socket_players.get(game_id, {}):
                disconnected_player_id = self.socket_players[game_id].pop(websocket)
                if disconnected_player_id in self.player_connections.get(game_id, {}):
                    self.player_connections[game_id][disconnected_player_id].discard(websocket)
                    player_still_connected = bool(self.player_connections[game_id][disconnected_player_id])
                    if not player_still_connected:
                        del self.player_connections[game_id][disconnected_player_id]
            if not self.active_connections[game_id]:
                del self.active_connections[game_id]
                if game_id in self.connection_timestamps:
                    del self.connection_timestamps[game_id]
                if game_id in self.socket_players:
                    del self.socket_players[game_id]
                if game_id in self.player_connections:
                    del self.player_connections[game_id]
        if disconnected_player_id and not player_still_connected:
            return disconnected_player_id
        return None

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
            self.disconnect(game_id, conn)

    async def heartbeat(self, game_id: str, websocket: WebSocket):
        """Update heartbeat timestamp for a connection."""
        if game_id in self.connection_timestamps and websocket in self.connection_timestamps[game_id]:
            self.connection_timestamps[game_id][websocket] = time.time()

    def get_active_connections_count(self, game_id: str) -> int:
        """Get number of active connections for a game."""
        return len(self.active_connections.get(game_id, []))

    async def cleanup_stale_connections(self, game_id: str, max_age_seconds: int = 60) -> List[str]:
        """Remove connections that haven't sent a heartbeat recently."""
        if game_id not in self.connection_timestamps:
            return []

        current_time = time.time()
        stale_connections = []
        disconnected_player_ids: List[str] = []

        for websocket, last_heartbeat in self.connection_timestamps[game_id].items():
            if current_time - last_heartbeat > max_age_seconds:
                stale_connections.append(websocket)

        for websocket in stale_connections:
            logger.info(f"Cleaning up stale connection for game {game_id}")
            player_id = self.disconnect(game_id, websocket)
            if player_id:
                disconnected_player_ids.append(player_id)

        return disconnected_player_ids


manager = ConnectionManager()


@app.middleware("http")
async def add_no_store_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.on_event("startup")
async def startup_event():
    """Start background tasks on startup."""
    asyncio.create_task(connection_cleanup_task())


async def connection_cleanup_task():
    """Periodically clean up stale connections."""
    while True:
        try:
            known_game_ids = set(store.list_game_ids()) | set(games.keys()) | set(manager.active_connections.keys())
            for game_id in known_game_ids:
                try:
                    engine = load_engine_or_404(game_id)
                except HTTPException:
                    continue

                timeout_seconds = get_disconnect_timeout_seconds(engine)
                disconnected_player_ids = await manager.cleanup_stale_connections(game_id, max_age_seconds=timeout_seconds)
                for player_id in disconnected_player_ids:
                    await mark_player_disconnected(game_id, player_id)
                expired_player_ids = await expire_long_disconnected_players(game_id, timeout_seconds=timeout_seconds)
                if expired_player_ids:
                    logger.info("Dropped disconnected players for game %s: %s", game_id, ", ".join(expired_player_ids))
        except Exception as e:
            logger.error(f"Error in connection cleanup task: {e}")

        # Run cleanup frequently so presence updates feel responsive.
        await asyncio.sleep(5)


def normalize_game_id(game_id: str) -> str:
    """Normalize game IDs for case-insensitive lookups."""
    return game_id.strip().lower()


def load_engine_or_404(game_id: str) -> GameEngine:
    game_id = normalize_game_id(game_id)

    engine = store.load_engine(game_id)
    if engine:
        games[game_id] = engine
        return engine

    if game_id in games:
        return games[game_id]

    raise HTTPException(status_code=404, detail="Game not found")


def persist_engine(game_id: str, engine: GameEngine) -> None:
    engine.state.last_activity_at = time.time()
    games[game_id] = engine
    store.save_engine(game_id, engine)


def get_disconnect_timeout_seconds(engine: GameEngine) -> int:
    return WAITING_ROOM_DISCONNECT_TIMEOUT_SECONDS if engine.state.phase == GamePhase.WAITING else IN_GAME_DISCONNECT_TIMEOUT_SECONDS


def is_allowed_origin(origin: Optional[str]) -> bool:
    if not origin:
        return True
    if ALLOWED_ORIGINS and origin in ALLOWED_ORIGINS:
        return True
    return re.match(ALLOWED_ORIGIN_REGEX, origin) is not None


def authenticate_player(engine: GameEngine, player_id: str, session_token: Optional[str]) -> None:
    player = engine.state.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    if not session_token or session_token != player.session_token:
        raise HTTPException(status_code=401, detail="Invalid player session")


async def mark_player_disconnected(game_id: str, player_id: str) -> None:
    engine = load_engine_or_404(game_id)
    if engine.mark_player_disconnected(player_id, disconnected_at=time.time()):
        persist_engine(game_id, engine)
        await broadcast_game_state(game_id)


async def expire_long_disconnected_players(game_id: str, timeout_seconds: int) -> List[str]:
    engine = load_engine_or_404(game_id)
    expired_player_ids = engine.expire_disconnected_players(time.time(), timeout_seconds)
    if expired_player_ids:
        persist_engine(game_id, engine)
        await broadcast_game_state(game_id)
    return expired_player_ids


async def mark_player_reconnected(game_id: str, player_id: str) -> None:
    engine = load_engine_or_404(game_id)
    if engine.mark_player_reconnected(player_id):
        persist_engine(game_id, engine)
        await broadcast_game_state(game_id)


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
        "creator_token": engine.state.creator_claim_token,
        "status": "created",
        "message": "Game created. Share this ID for others to join."
    }


@app.post("/games/{game_id}/join")
async def join_game(game_id: str, name: str, x_creator_token: Optional[str] = Header(default=None)):
    """Join an existing game."""
    game_id = normalize_game_id(game_id)
    engine = load_engine_or_404(game_id)

    if engine.state.phase != GamePhase.WAITING:
        raise HTTPException(status_code=400, detail="Game has already started")

    try:
        player = engine.add_player(name)
        if (
            engine.state.owner_player_id is None
            and engine.state.creator_claim_token
            and x_creator_token == engine.state.creator_claim_token
        ):
            engine.state.owner_player_id = player.id
            engine.state.creator_claim_token = None
        persist_engine(game_id, engine)
        return {
            "player_id": player.id,
            "player_name": player.name,
            "session_token": player.session_token,
            "is_owner": engine.state.owner_player_id == player.id,
            "game_id": game_id,
            "message": f"Joined game {game_id}"
        }
    except GameError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as exc:
        logger.exception("Failed to join game %s", game_id)
        raise HTTPException(status_code=500, detail="Server error while joining game")


@app.post("/games/{game_id}/start")
async def start_game(game_id: str, player_id: str, x_player_token: Optional[str] = Header(default=None)):
    """Start the game."""
    game_id = normalize_game_id(game_id)
    engine = load_engine_or_404(game_id)
    authenticate_player(engine, player_id, x_player_token)
    if engine.state.owner_player_id != player_id:
        raise HTTPException(status_code=403, detail="Only the game creator can start the game")

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
async def get_game_state(
    game_id: str,
    player_id: str = None,
    x_player_token: Optional[str] = Header(default=None)
):
    """Get current game state."""
    game_id = normalize_game_id(game_id)
    engine = load_engine_or_404(game_id)

    if player_id:
        authenticate_player(engine, player_id, x_player_token)
        await mark_player_reconnected(game_id, player_id)
        engine = load_engine_or_404(game_id)
        return engine.get_game_state_for_player(player_id)

    return engine.state.to_dict()


@app.post("/games/{game_id}/play")
async def play_card(
    game_id: str,
    player_id: str,
    suit: str,
    rank: str,
    x_player_token: Optional[str] = Header(default=None)
):
    """Play a card."""
    game_id = normalize_game_id(game_id)
    engine = load_engine_or_404(game_id)
    authenticate_player(engine, player_id, x_player_token)
    await mark_player_reconnected(game_id, player_id)
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
    if not is_allowed_origin(websocket.headers.get("origin")):
        await websocket.close(code=4403, reason="Origin not allowed")
        return
    try:
        engine = load_engine_or_404(game_id)
    except HTTPException:
        await websocket.close(code=4000, reason="Game not found")
        return

    await manager.connect(game_id, websocket)

    try:
        while True:
            # Set a timeout for receiving messages to allow heartbeat checks
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                action = message.get("action")

                # Update heartbeat on any message
                await manager.heartbeat(game_id, websocket)

                if action == "join":
                    # Store player_id on websocket for personalized updates
                    player_id = message.get("player_id")
                    session_token = message.get("session_token")
                    if player_id:
                        player = engine.state.get_player(player_id)
                        if not player or player.session_token != session_token:
                            await websocket.send_json({
                                "type": "error",
                                "data": {"message": "Invalid player session"}
                            })
                            continue
                        manager.assign_player(game_id, websocket, player_id)
                        await mark_player_reconnected(game_id, player_id)
                        websocket.player_id = player_id
                        await websocket.send_json({
                            "type": "joined",
                            "data": {"player_id": player_id, "game_id": game_id}
                        })
                        # Send initial state after joining
                        await broadcast_game_state(game_id)

                elif action == "play":
                    # Handle play via WebSocket
                    player_id = message.get("player_id")
                    suit = message.get("suit")
                    rank = message.get("rank")
                    session_token = message.get("session_token")

                    if not all([player_id, suit, rank]):
                        await websocket.send_json({
                            "type": "error",
                            "data": {"message": "Missing required fields"}
                        })
                        continue

                    try:
                        player = engine.state.get_player(player_id)
                        if not player or player.session_token != session_token:
                            await websocket.send_json({
                                "type": "error",
                                "data": {"message": "Invalid player session"}
                            })
                            continue
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

                elif action == "heartbeat":
                    # Client heartbeat - just update timestamp
                    await websocket.send_json({
                        "type": "heartbeat_ack",
                        "data": {"timestamp": time.time()}
                    })

            except Exception as e:
                # If we can't receive/parse message, connection might be broken
                logger.warning(f"Error receiving message from websocket in game {game_id}: {e}")
                break

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for game {game_id}")
    except Exception as e:
        logger.error(f"Unexpected error in websocket handler for game {game_id}: {e}")
    finally:
        player_id = manager.disconnect(game_id, websocket)
        if player_id:
            await mark_player_disconnected(game_id, player_id)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    connection_counts = {}
    for game_id in manager.active_connections:
        connection_counts[game_id] = manager.get_active_connections_count(game_id)

    return {
        "status": "healthy",
        "games_active": len(games),
        "store": "redis" if store._client else "memory",
        "connections": connection_counts,
        "total_connections": sum(connection_counts.values())
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
