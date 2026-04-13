from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum
import uuid


class Suit(str, Enum):
    HEARTS = "hearts"
    DIAMONDS = "diamonds"
    CLUBS = "clubs"
    SPADES = "spades"


class Rank(str, Enum):
    TWO = "2"
    THREE = "3"
    FOUR = "4"
    FIVE = "5"
    SIX = "6"
    SEVEN = "7"
    EIGHT = "8"
    NINE = "9"
    TEN = "10"
    JACK = "J"
    QUEEN = "Q"
    KING = "K"
    ACE = "A"


RANK_ORDER = {
    Rank.TWO: 2, Rank.THREE: 3, Rank.FOUR: 4, Rank.FIVE: 5,
    Rank.SIX: 6, Rank.SEVEN: 7, Rank.EIGHT: 8, Rank.NINE: 9,
    Rank.TEN: 10, Rank.JACK: 11, Rank.QUEEN: 12, Rank.KING: 13, Rank.ACE: 14
}


class Card(BaseModel):
    suit: Suit
    rank: Rank

    def __hash__(self):
        return hash((self.suit, self.rank))

    def __eq__(self, other):
        if not isinstance(other, Card):
            return False
        return self.suit == other.suit and self.rank == other.rank

    def __lt__(self, other):
        if not isinstance(other, Card):
            return NotImplemented
        return RANK_ORDER[self.rank] < RANK_ORDER[other.rank]

    def __gt__(self, other):
        if not isinstance(other, Card):
            return NotImplemented
        return RANK_ORDER[self.rank] > RANK_ORDER[other.rank]

    def __le__(self, other):
        if not isinstance(other, Card):
            return NotImplemented
        return RANK_ORDER[self.rank] <= RANK_ORDER[other.rank]

    def __ge__(self, other):
        if not isinstance(other, Card):
            return NotImplemented
        return RANK_ORDER[self.rank] >= RANK_ORDER[other.rank]

    def is_ace_of_spades(self) -> bool:
        return self.suit == Suit.SPADES and self.rank == Rank.ACE

    def to_dict(self):
        return {"suit": self.suit.value, "rank": self.rank.value}


class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str
    hand: List[Card] = Field(default_factory=list)

    class Config:
        arbitrary_types_allowed = True

    @property
    def card_count(self) -> int:
        return len(self.hand)

    def has_card(self, card: Card) -> bool:
        return card in self.hand

    def remove_card(self, card: Card) -> bool:
        if card in self.hand:
            self.hand.remove(card)
            return True
        return False

    def add_cards(self, cards: List[Card]):
        self.hand.extend(cards)

    def has_suit(self, suit: Suit) -> bool:
        return any(c.suit == suit for c in self.hand)

    def get_cards_of_suit(self, suit: Suit) -> List[Card]:
        return [c for c in self.hand if c.suit.value == suit.value]

    def sort_hand(self):
        """Sort hand by suit, then by rank"""
        suit_order = {Suit.SPADES: 0, Suit.HEARTS: 1, Suit.CLUBS: 2, Suit.DIAMONDS: 3}
        self.hand.sort(key=lambda c: (suit_order[c.suit], RANK_ORDER[c.rank]))



class GamePhase(str, Enum):
    WAITING = "waiting"      # Waiting for players to join
    PLAYING = "playing"        # Active gameplay
    FINISHED = "finished"      # Game over


class PlayedCard(BaseModel):
    card: Card
    player_id: str


class GameState(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    players: List[Player] = Field(default_factory=list)
    current_player_index: int = 0
    pile: List[PlayedCard] = Field(default_factory=list)
    discarded_pile: List[PlayedCard] = Field(default_factory=list)
    lead_suit: Optional[Suit] = None
    phase: GamePhase = GamePhase.WAITING
    winner_id: Optional[str] = None
    starting_player_id: Optional[str] = None
    passed_pile_count: int = 0

    class Config:
        arbitrary_types_allowed = True

    @property
    def current_player(self) -> Optional[Player]:
        if 0 <= self.current_player_index < len(self.players):
            return self.players[self.current_player_index]
        return None

    def get_player(self, player_id: str) -> Optional[Player]:
        for player in self.players:
            if player.id == player_id:
                return player
        return None

    def get_next_player_index(self) -> int:
        return (self.current_player_index + 1) % len(self.players)

    def advance_turn(self):
        self.current_player_index = self.get_next_player_index()

    def to_dict(self):
        return {
            "id": self.id,
            "players": [
                {
                    "id": p.id,
                    "name": p.name,
                    "card_count": p.card_count,
                    "hand": [c.to_dict() for c in p.hand] if len(self.players) <= 2 else None
                }
                for p in self.players
            ],
            "current_player_id": self.current_player.id if self.current_player else None,
            "pile": [{"card": pc.card.to_dict(), "player_id": pc.player_id} for pc in self.pile],
            "discarded_pile": [{"card": pc.card.to_dict(), "player_id": pc.player_id} for pc in self.discarded_pile],
            "lead_suit": self.lead_suit.value if self.lead_suit else None,
            "phase": self.phase.value,
            "winner_id": self.winner_id,
            "passed_pile_count": self.passed_pile_count
        }
