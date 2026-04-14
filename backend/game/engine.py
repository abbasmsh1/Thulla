from typing import List, Optional, Dict
from .models import (
    Card, Player, GameState, GamePhase, PlayedCard,
    Suit, RANK_ORDER
)
from .deck import Deck


class GameError(Exception):
    """Custom exception for game-related errors."""
    pass


class GameEngine:
    def __init__(self, game_state: Optional[GameState] = None):
        self.state = game_state or GameState()
        self.deck: Optional[Deck] = None

    def add_player(self, name: str) -> Player:
        """Add a player to the game."""
        if self.state.phase != GamePhase.WAITING:
            raise GameError("Cannot add players after game has started")

        player = Player(name=name)
        self.state.players.append(player)
        return player

    def _is_player_dropped(self, player_id: str) -> bool:
        return player_id in self.state.dropped_player_ids

    def _is_turn_eligible(self, player: Player) -> bool:
        return player.card_count > 0 and not self._is_player_dropped(player.id)

    def ensure_valid_current_player(self) -> None:
        if self.state.phase != GamePhase.PLAYING or not self.state.players:
            return

        player_count = len(self.state.players)
        for offset in range(player_count):
            index = (self.state.current_player_index + offset) % player_count
            player = self.state.players[index]
            if self._is_turn_eligible(player):
                self.state.current_player_index = index
                return

    def mark_player_disconnected(self, player_id: str, disconnected_at: Optional[float] = None) -> bool:
        if not self.state.get_player(player_id):
            return False
        if player_id in self.state.disconnected_at:
            return False
        self.state.disconnected_at[player_id] = disconnected_at or 0.0
        return True

    def expire_disconnected_players(self, current_time: float, timeout_seconds: int) -> List[str]:
        expired: List[str] = []
        for player_id, since in list(self.state.disconnected_at.items()):
            if current_time - since >= timeout_seconds and player_id not in self.state.dropped_player_ids:
                self.state.dropped_player_ids.append(player_id)
                expired.append(player_id)

        if expired:
            self.ensure_valid_current_player()
        return expired

    def mark_player_reconnected(self, player_id: str) -> bool:
        player = self.state.get_player(player_id)
        if not player:
            return False

        changed = False
        if player_id in self.state.disconnected_at:
            del self.state.disconnected_at[player_id]
            changed = True
        if player_id in self.state.dropped_player_ids:
            self.state.dropped_player_ids = [pid for pid in self.state.dropped_player_ids if pid != player_id]
            changed = True

        if changed:
            self.ensure_valid_current_player()
        return changed

    def remove_player(self, player_id: str) -> bool:
        """Remove a player from the game."""
        if self.state.phase != GamePhase.WAITING:
            raise GameError("Cannot remove players after game has started")

        self.state.players = [p for p in self.state.players if p.id != player_id]
        return len(self.state.players) < len(self.state.players) + 1

    def start_game(self) -> GameState:
        """Start the game: deal cards and find starting player."""
        if len(self.state.players) < 2:
            raise GameError("Need at least 2 players to start")

        if self.state.phase != GamePhase.WAITING:
            raise GameError("Game has already started")

        # Create deck and deal cards
        self.deck = Deck(len(self.state.players))
        self.deck.deal(self.state.players)

        # Sort hands
        for p in self.state.players:
            p.sort_hand()

        # Find player with Ace of Spades
        starting_player = self.deck.find_ace_of_spades_holder(self.state.players)
        self.state.starting_player_id = starting_player.id

        # Set current player to starting player
        for i, player in enumerate(self.state.players):
            if player.id == starting_player.id:
                self.state.current_player_index = i
                break

        self.state.phase = GamePhase.PLAYING
        self.ensure_valid_current_player()
        return self.state

    def get_valid_plays(self, player_id: str) -> List[Card]:
        """Get valid cards that the player can play."""
        player = self.state.get_player(player_id)
        if not player:
            raise GameError(f"Player {player_id} not found")

        # 1. Force Ace of Spades on the absolute first turn
        if not self.state.pile and self.state.passed_pile_count == 0 and not self.state.winner_id:
            for card in player.hand:
                if card.is_ace_of_spades():
                    return [card]

        # 2. Free lead if pile is empty
        if not self.state.pile:
            return player.hand.copy()

        # 3. Otherwise, strictly follow lead_suit
        lead_suit_val = self.state.lead_suit.value if self.state.lead_suit else self.state.pile[0].card.suit.value
        matching_cards = [c for c in player.hand if c.suit.value == lead_suit_val]
        
        if matching_cards:
            return matching_cards

        # 4. If no matching suit at all, any card is valid (this initiates a Thulla)
        return player.hand.copy()

    def play_card(self, player_id: str, card: Card) -> Dict:
        """Process a player playing a card.

        Returns dict with:
        - success: bool
        - message: str
        - pile_complete: bool (if trick is complete)
        - pile_passed: bool (True if all followed suit — pile is set aside)
        - winner_id: str (if trick is complete and not passed, who picks up)
        - game_over: bool
        """
        result = {
            "success": False,
            "message": "",
            "pile_complete": False,
            "pile_passed": False,
            "winner_id": None,
            "game_over": False
        }

        # Validate game state
        if self.state.phase != GamePhase.PLAYING:
            result["message"] = "Game is not in playing phase"
            return result

        self.ensure_valid_current_player()

        # Validate it's the player's turn
        current_player = self.state.current_player
        if not current_player or current_player.id != player_id:
            result["message"] = "Not your turn"
            return result

        player = self.state.get_player(player_id)
        if not player:
            result["message"] = "Player not found"
            return result

        # Validate player has the card
        if not player.has_card(card):
            result["message"] = "You don't have that card"
            return result

        # Validate card is a valid play
        valid_plays = self.get_valid_plays(player_id)
        if card not in valid_plays:
            result["message"] = f"Must follow suit: {self.state.lead_suit.value if self.state.lead_suit else 'any'}"
            return result

        # Capture whether the player had any lead-suit cards before this play.
        # A "Thulla" only happens when a player is truly void in the lead suit.
        had_lead_suit_before_play = False
        if self.state.pile and self.state.lead_suit is not None:
            lead_suit_val = str(self.state.lead_suit.value if hasattr(self.state.lead_suit, 'value') else self.state.lead_suit).lower()
            had_lead_suit_before_play = any(
                str(c.suit.value if hasattr(c.suit, 'value') else c.suit).lower() == lead_suit_val
                for c in player.hand
            )

        # Play the card
        player.remove_card(card)
        self.state.pile.append(PlayedCard(card=card, player_id=player_id))

        # Set lead suit if this is the first card of the trick
        if self.state.lead_suit is None:
            self.state.lead_suit = card.suit

        # Check strictly for Thulla (value comparison avoids Enum identity issues)
        is_thulla = False
        if len(self.state.pile) > 1:
            # Strictly compare string values to avoid any Enum identity issues
            current_suit = str(card.suit.value if hasattr(card.suit, 'value') else card.suit).lower()
            lead_suit_val = str(self.state.lead_suit.value if hasattr(self.state.lead_suit, 'value') else self.state.lead_suit).lower()

            # Treat as Thulla only when the player could not follow lead suit.
            if current_suit != lead_suit_val and not had_lead_suit_before_play:
                is_thulla = True

        # Check if pile is complete (everyone played and followed suit) or Thulla played
        if is_thulla or len(self.state.pile) == len(self.state.players):
            result["pile_complete"] = True

            if is_thulla:
                # "Thulla" was played! Game ends immediately. Highest card of lead suit picks up
                winner = self._evaluate_pile()
                result["winner_id"] = winner.id

                # Winner picks up the pile
                winner_player = self.state.get_player(winner.id)
                if winner_player:
                    cards_from_pile = [pc.card for pc in self.state.pile]
                    winner_player.add_cards(cards_from_pile)
                    winner_player.sort_hand()

                # Clear pile and lead suit
                self.state.pile = []
                self.state.lead_suit = None

                # Winner must lead next round
                for i, p in enumerate(self.state.players):
                    if p.id == winner.id:
                        self.state.current_player_index = i
                        break
            else:
                # Everyone played and followed suit -> Passed Pile
                result["pile_passed"] = True

                # Move pile to discarded pile
                self.state.discarded_pile.extend(self.state.pile)

                # Determine winner of the passed pile to lead next
                winner = self._evaluate_pile()

                self.state.pile = []
                self.state.lead_suit = None
                self.state.passed_pile_count += 1

                # Set highest card player as next leader
                for i, p in enumerate(self.state.players):
                    if p.id == winner.id:
                        self.state.current_player_index = i
                        break

            # Check for game over
            if self._check_winner():
                result["game_over"] = True
                self.state.phase = GamePhase.FINISHED
        else:
            # Move to next player
            self.state.advance_turn()
            self.ensure_valid_current_player()

        result["success"] = True
        return result

    def _evaluate_pile(self) -> Player:
        """Determine which player wins the trick.

        The winner is the player who played the highest card of the lead suit.
        """
        if not self.state.pile:
            raise GameError("Cannot evaluate empty pile")

        # Find the highest card of the lead suit strictly
        lead_cards = [pc for pc in self.state.pile if pc.card.suit.value == self.state.lead_suit.value]

        if not lead_cards:
            # This shouldn't happen, but fallback to first player
            first_card = self.state.pile[0]
            return self.state.get_player(first_card.player_id)

        # Find highest card by rank (safe comparison)
        highest = max(lead_cards, key=lambda pc: RANK_ORDER[pc.card.rank])
        return self.state.get_player(highest.player_id)

    def _check_winner(self) -> bool:
        """Track finishing order and finish when only one player has cards left."""
        for player in self.state.players:
            if player.card_count == 0 and player.id not in self.state.finish_order:
                self.state.finish_order.append(player.id)

        remaining_players = [player for player in self.state.players if player.card_count > 0]
        if len(remaining_players) > 1:
            if self.state.finish_order:
                self.state.winner_id = self.state.finish_order[0]
            return False

        if len(remaining_players) == 1 and remaining_players[0].id not in self.state.finish_order:
            self.state.finish_order.append(remaining_players[0].id)

        if self.state.finish_order:
            self.state.winner_id = self.state.finish_order[0]
            return True

        return False

    def get_game_state_for_player(self, player_id: str) -> Dict:
        """Get game state with player-specific info (their hand visible)."""
        self.ensure_valid_current_player()
        state = self.state.to_dict()

        # Add current player's hand
        player = self.state.get_player(player_id)
        if player:
            state["your_hand"] = [c.to_dict() for c in player.hand]
            state["your_id"] = player_id
            state["valid_plays"] = [c.to_dict() for c in self.get_valid_plays(player_id)]

        return state

    def skip_turn(self, player_id: str) -> Dict:
        """Skip a player's turn (if they have no valid moves - shouldn't happen in this game).

        This game requires playing a card every turn, so this is mainly for error handling.
        """
        player = self.state.get_player(player_id)
        if not player:
            return {"success": False, "message": "Player not found"}

        if player.card_count == 0:
            self.state.advance_turn()
            self.ensure_valid_current_player()
            return {"success": True, "message": "Turn skipped (no cards)"}

        return {"success": False, "message": "Cannot skip - you have cards to play"}
