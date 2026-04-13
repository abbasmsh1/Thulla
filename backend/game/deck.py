import random
import math
from typing import List
from .models import Card, Suit, Rank, Player


SUITS = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES]
RANKS = [
    Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN,
    Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE
]


def calculate_deck_count(player_count: int) -> int:
    """Calculate how many decks needed based on player count.
    One deck per 7 players (rounded up)."""
    return max(1, math.ceil(player_count / 7))


class Deck:
    def __init__(self, player_count: int):
        self.player_count = player_count
        self.deck_count = calculate_deck_count(player_count)
        self.cards: List[Card] = []
        self._create_deck()

    def _create_deck(self):
        """Create the required number of standard 52-card decks."""
        self.cards = []
        for _ in range(self.deck_count):
            for suit in SUITS:
                for rank in RANKS:
                    self.cards.append(Card(suit=suit, rank=rank))

    def shuffle(self):
        """Shuffle the deck in place."""
        random.shuffle(self.cards)

    def deal(self, players: List[Player]) -> 'Deck':
        """Deal all cards evenly to players."""
        if not players:
            raise ValueError("Cannot deal to empty player list")

        self.shuffle()

        player_count = len(players)
        card_index = 0

        while card_index < len(self.cards):
            for player in players:
                if card_index < len(self.cards):
                    player.hand.append(self.cards[card_index])
                    card_index += 1
                else:
                    break

        return self

    def find_ace_of_spades_holder(self, players: List[Player]) -> Player:
        """Find which player has the Ace of Spades."""
        ace_of_spades = Card(suit=Suit.SPADES, rank=Rank.ACE)

        for player in players:
            if ace_of_spades in player.hand:
                return player

        raise ValueError("No player has the Ace of Spades")

    def remaining(self) -> int:
        """Return number of remaining cards in deck."""
        return len(self.cards)

    def draw(self) -> Card:
        """Draw one card from the top of the deck."""
        if not self.cards:
            raise IndexError("Cannot draw from empty deck")
        return self.cards.pop()

    def reset(self):
        """Reset and recreate the deck."""
        self._create_deck()
