import React, { useState, useEffect, useCallback } from 'react';
import { gameApi } from './api/gameApi';
import { useGameSocket } from './hooks/useGameSocket';
import { GameBoard } from './components/GameBoard';
import { Card as CardType, GameStateWithHand } from './types/game';

const App: React.FC = () => {
  // Game state
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [gameState, setGameState] = useState<GameStateWithHand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Join form state
  const [joinGameId, setJoinGameId] = useState('');
  const [view, setView] = useState<'home' | 'create' | 'join' | 'lobby' | 'game'>('home');

  // WebSocket connection
  const { isConnected, lastMessage, playCard, getState, reconnect } = useGameSocket(gameId, playerId);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'game_state':
          {
            const nextState = lastMessage.data as GameStateWithHand;
            setGameState(nextState);

            // In polling/fallback mode we may not receive explicit lifecycle WS events.
            // Keep view in sync with authoritative server phase.
            if (nextState.phase === 'playing' && view !== 'game') {
              setView('game');
            } else if (nextState.phase === 'finished' && view !== 'game') {
              setView('game');
            }
          }
          break;
        case 'game_started':
          setView('game');
          // Ensure we always hydrate the latest authoritative state after start.
          getState();
          break;
        case 'pile_complete':
          console.log('Pile complete:', lastMessage.data);
          // Resync after trick resolution to avoid dropped intermediate WS messages.
          getState();
          break;
        case 'game_over':
          console.log('Game over:', lastMessage.data);
          getState();
          break;
        case 'error':
          setError(lastMessage.data.message);
          break;
      }
    }
  }, [lastMessage, getState, view]);

  // Create game
  const handleCreateGame = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await gameApi.createGame();
      setGameId(result.game_id);
      setView('create');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
    } finally {
      setIsLoading(false);
    }
  };

  // Join game
  const handleJoinGame = async () => {
    if (!joinGameId.trim() || !playerName.trim()) {
      setError('Please enter both game ID and your name');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await gameApi.joinGame(joinGameId, playerName);
      setGameId(joinGameId);
      setPlayerId(result.player_id);
      setView('lobby');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join game');
    } finally {
      setIsLoading(false);
    }
  };

  // Join from create screen
  const handleJoinCreatedGame = async () => {
    if (!gameId || !playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await gameApi.joinGame(gameId, playerName);
      setPlayerId(result.player_id);
      setView('lobby');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join game');
    } finally {
      setIsLoading(false);
    }
  };

  // Start game
  const handleStartGame = async () => {
    if (!gameId) return;

    setIsLoading(true);
    setError(null);
    try {
      await gameApi.startGame(gameId);
      setView('game');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game');
    } finally {
      setIsLoading(false);
    }
  };

  // Play card
  const handlePlayCard = useCallback((card: CardType) => {
    if (!gameId || !playerId) return;
    playCard(card.suit, card.rank);
  }, [gameId, playerId, playCard]);

  // Home screen
  if (view === 'home') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Ambient glow orbs */}
        <div className="ambient-orb" style={{
          background: 'radial-gradient(circle, rgba(139, 0, 0, 0.4) 0%, transparent 70%)',
          width: '500px',
          height: '500px',
          top: '-150px',
          left: '-150px'
        }} />
        <div className="ambient-orb" style={{
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.3) 0%, transparent 70%)',
          width: '600px',
          height: '600px',
          bottom: '-200px',
          right: '-200px'
        }} />

        {/* Main title */}
        <div style={{
          textAlign: 'center',
          marginBottom: '70px',
          zIndex: 2,
          position: 'relative'
        }}>
          <div style={{
            fontSize: '24px',
            color: 'rgba(254, 249, 231, 0.6)',
            letterSpacing: '8px',
            textTransform: 'uppercase',
            marginBottom: '10px',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 300
          }}>
            The Card Game
          </div>
          <h1 className="title-glow" style={{
            fontSize: '7rem',
            marginBottom: '15px',
            fontFamily: 'Cormorant Garamond, serif',
            fontWeight: 700,
            letterSpacing: '12px',
            textTransform: 'uppercase',
            filter: 'drop-shadow(0 4px 20px rgba(212, 175, 55, 0.4))'
          }}>
            Thulla
          </h1>
          <div style={{
            width: '200px',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #d4af37, transparent)',
            margin: '20px auto'
          }} />
          <p style={{
            color: 'rgba(254, 249, 231, 0.5)',
            fontSize: '14px',
            letterSpacing: '4px',
            textTransform: 'uppercase',
            fontFamily: 'Montserrat, sans-serif',
            marginTop: '20px'
          }}>
            Strategy • Deception • Victory
          </p>
        </div>

        {/* Menu panel */}
        <div className="glass-panel" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          width: '100%',
          maxWidth: '420px',
          padding: '45px',
          zIndex: 2,
          position: 'relative',
          animation: 'slideUp 0.6s ease-out'
        }}>
          <button
            className="glass-button"
            onClick={handleCreateGame}
            disabled={isLoading}
            style={{ width: '100%' }}
          >
            {isLoading ? 'Creating...' : 'Create New Game'}
          </button>
          <button
            className="glass-button glass-button-secondary"
            onClick={() => setView('join')}
            style={{ width: '100%' }}
          >
            Join Existing Game
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div style={{
            marginTop: '25px',
            padding: '16px 24px',
            background: 'rgba(196, 30, 58, 0.2)',
            border: '1px solid rgba(196, 30, 58, 0.4)',
            color: '#f8a5a5',
            borderRadius: '12px',
            zIndex: 2,
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '14px',
            animation: 'fadeIn 0.3s ease-out',
            boxShadow: '0 4px 20px rgba(196, 30, 58, 0.3)'
          }}>
            ⚠ {error}
          </div>
        )}
      </div>
    );
  }

  // Join screen
  if (view === 'join') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        position: 'relative',
        zIndex: 1
      }}>
        <div className="ambient-orb" style={{
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.3) 0%, transparent 70%)',
          width: '500px',
          height: '500px',
          top: '-150px',
          left: '-150px'
        }} />

        <div className="glass-panel" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '22px',
          width: '100%',
          maxWidth: '420px',
          padding: '55px',
          zIndex: 2,
          animation: 'slideUp 0.5s ease-out'
        }}>
          <h2 className="title-glow" style={{
            fontSize: '2.2rem',
            marginBottom: '5px',
            textAlign: 'center',
            fontFamily: 'Cormorant Garamond, serif',
            fontWeight: 700,
            letterSpacing: '4px'
          }}>
            Join Game
          </h2>

          <div style={{
            width: '60px',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #d4af37, transparent)',
            margin: '10px auto'
          }} />

          <input
            type="text"
            className="glass-input"
            placeholder="Game ID"
            value={joinGameId}
            onChange={(e) => setJoinGameId(e.target.value)}
            style={{ textAlign: 'center', letterSpacing: '3px', fontFamily: 'monospace' }}
          />

          <input
            type="text"
            className="glass-input"
            placeholder="Your Name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />

          <button
            className="glass-button"
            onClick={handleJoinGame}
            disabled={isLoading || !playerName.trim() || !joinGameId.trim()}
            style={{ marginTop: '10px' }}
          >
            {isLoading ? 'Joining...' : 'Enter Arena'}
          </button>

          <button
            className="glass-button glass-button-secondary"
            onClick={() => setView('home')}
          >
            Back
          </button>
        </div>

        {error && (
          <div style={{
            marginTop: '25px',
            padding: '16px 24px',
            background: 'rgba(196, 30, 58, 0.2)',
            border: '1px solid rgba(196, 30, 58, 0.4)',
            color: '#f8a5a5',
            borderRadius: '12px',
            zIndex: 2,
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '14px',
            animation: 'fadeIn 0.3s ease-out',
            boxShadow: '0 4px 20px rgba(196, 30, 58, 0.3)'
          }}>
            ⚠ {error}
          </div>
        )}
      </div>
    );
  }

  // Create game screen (waiting for players)
  if (view === 'create') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        position: 'relative',
        zIndex: 1
      }}>
        <div className="ambient-orb" style={{
          background: 'radial-gradient(circle, rgba(139, 0, 0, 0.4) 0%, transparent 70%)',
          width: '500px',
          height: '500px',
          top: '-150px',
          left: '-150px'
        }} />

        <div className="glass-panel" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '22px',
          width: '100%',
          maxWidth: '450px',
          padding: '55px',
          zIndex: 2,
          textAlign: 'center',
          animation: 'slideUp 0.5s ease-out'
        }}>
          <h2 className="title-glow" style={{
            fontSize: '2.2rem',
            marginBottom: '10px',
            fontFamily: 'Cormorant Garamond, serif',
            fontWeight: 700,
            letterSpacing: '4px'
          }}>
            Game Created
          </h2>

          <div style={{
            width: '80px',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #d4af37, transparent)',
            margin: '15px auto'
          }} />

          <div style={{
            background: 'rgba(0,0,0,0.4)',
            padding: '25px',
            borderRadius: '14px',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
          }}>
            <p style={{
              margin: '0 0 12px 0',
              color: 'rgba(254, 249, 231, 0.5)',
              textTransform: 'uppercase',
              letterSpacing: '3px',
              fontSize: '0.75rem',
              fontFamily: 'Montserrat, sans-serif'
            }}>
              Game Code
            </p>
            <div style={{
              fontSize: '2.5rem',
              letterSpacing: '6px',
              color: '#d4af37',
              fontFamily: 'monospace',
              fontWeight: 700,
              textShadow: '0 0 20px rgba(212, 175, 55, 0.5)'
            }}>
              {gameId?.toUpperCase()}
            </div>
          </div>

          <input
            type="text"
            className="glass-input"
            placeholder="Your Name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />

          <button
            className="glass-button"
            onClick={handleJoinCreatedGame}
            disabled={isLoading || !playerName.trim()}
          >
            {isLoading ? 'Joining...' : 'Enter Lobby'}
          </button>

          <button
            className="glass-button glass-button-secondary"
            onClick={() => setView('home')}
          >
            Cancel
          </button>
        </div>

        {error && (
          <div style={{
            marginTop: '25px',
            padding: '16px 24px',
            background: 'rgba(196, 30, 58, 0.2)',
            border: '1px solid rgba(196, 30, 58, 0.4)',
            color: '#f8a5a5',
            borderRadius: '12px',
            zIndex: 2,
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '14px',
            animation: 'fadeIn 0.3s ease-out',
            boxShadow: '0 4px 20px rgba(196, 30, 58, 0.3)'
          }}>
            ⚠ {error}
          </div>
        )}
      </div>
    );
  }

  // Lobby screen
  if (view === 'lobby') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        position: 'relative',
        zIndex: 1
      }}>
        <div className="ambient-orb" style={{
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.3) 0%, transparent 70%)',
          width: '500px',
          height: '500px',
          top: '-150px',
          left: '-150px'
        }} />

        <div className="glass-panel" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '25px',
          width: '100%',
          maxWidth: '520px',
          padding: '55px',
          zIndex: 2,
          textAlign: 'center',
          animation: 'slideUp 0.5s ease-out'
        }}>
          <h2 className="title-glow" style={{
            fontSize: '2.8rem',
            fontFamily: 'Cormorant Garamond, serif',
            fontWeight: 700,
            letterSpacing: '6px',
            marginBottom: '10px'
          }}>
            Match Lobby
          </h2>

          <div style={{
            width: '100px',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #d4af37, transparent)',
            margin: '10px auto'
          }} />

          <div style={{
            background: 'rgba(0,0,0,0.4)',
            padding: '30px',
            borderRadius: '16px',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            boxShadow: 'inset 0 2px 15px rgba(0,0,0,0.5)',
            marginBottom: '15px'
          }}>
            <p style={{
              margin: '0 0 15px 0',
              color: 'rgba(254, 249, 231, 0.5)',
              textTransform: 'uppercase',
              letterSpacing: '3px',
              fontSize: '0.75rem',
              fontFamily: 'Montserrat, sans-serif'
            }}>
              Game Code
            </p>
            <div style={{
              fontSize: '3.5rem',
              letterSpacing: '8px',
              color: '#d4af37',
              fontFamily: 'monospace',
              fontWeight: 700,
              textShadow: '0 0 30px rgba(212, 175, 55, 0.6)',
              marginBottom: '15px'
            }}>
              {gameId?.toUpperCase()}
            </div>
            <div style={{
              fontSize: '0.85rem',
              color: isConnected ? '#4ade80' : '#f87171',
              fontFamily: 'Montserrat, sans-serif',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isConnected ? '#4ade80' : '#f87171',
                display: 'inline-block',
                boxShadow: `0 0 10px ${isConnected ? '#4ade80' : '#f87171'}`,
                animation: 'pulse 1.5s ease-in-out infinite'
              }} />
              {isConnected ? 'Connected to Server' : 'Reconnecting...'}
            </div>
          </div>

          <button
            className="glass-button"
            onClick={handleStartGame}
            disabled={isLoading}
            style={{ width: '100%', marginTop: '10px' }}
          >
            {isLoading ? 'Shuffling...' : 'Deal Cards'}
          </button>

          <p style={{
            color: 'rgba(254, 249, 231, 0.4)',
            fontSize: '0.9rem',
            fontFamily: 'Montserrat, sans-serif',
            letterSpacing: '1px',
            fontStyle: 'italic'
          }}>
            Waiting for commander to initiate...
          </p>
        </div>

        {error && (
          <div style={{
            marginTop: '25px',
            padding: '16px 24px',
            background: 'rgba(196, 30, 58, 0.2)',
            border: '1px solid rgba(196, 30, 58, 0.4)',
            color: '#f8a5a5',
            borderRadius: '12px',
            zIndex: 2,
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '14px',
            animation: 'fadeIn 0.3s ease-out',
            boxShadow: '0 4px 20px rgba(196, 30, 58, 0.3)'
          }}>
            ⚠ {error}
          </div>
        )}
      </div>
    );
  }

  // Game screen
  if (view === 'game' && gameState) {
    return (
      <GameBoard
        gameState={gameState}
        onPlayCard={handlePlayCard}
        isConnected={isConnected}
        onReconnect={reconnect}
      />
    );
  }

  return null;
};

export default App;
