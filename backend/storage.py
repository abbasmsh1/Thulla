import json
import os
from typing import Dict, Optional

from game.engine import GameEngine
from game.models import GameState

try:
    import redis  # type: ignore
except Exception:  # pragma: no cover - optional dependency at runtime
    redis = None


class GameStore:
    def __init__(self):
        self._memory: Dict[str, str] = {}
        self._prefix = "thulla:game:"
        self._client = None

        redis_url = os.getenv("REDIS_URL")
        if redis_url and redis is not None:
            self._client = redis.from_url(redis_url, decode_responses=True)

    def _key(self, game_id: str) -> str:
        return f"{self._prefix}{game_id}"

    def save_engine(self, game_id: str, engine: GameEngine) -> None:
        payload = json.dumps(engine.state.model_dump(mode="json"))
        if self._client is not None:
            self._client.set(self._key(game_id), payload)
            return
        self._memory[game_id] = payload

    def load_engine(self, game_id: str) -> Optional[GameEngine]:
        payload = None
        if self._client is not None:
            payload = self._client.get(self._key(game_id))
        else:
            payload = self._memory.get(game_id)

        if not payload:
            return None

        state_data = json.loads(payload)
        state = GameState.model_validate(state_data)
        return GameEngine(game_state=state)
