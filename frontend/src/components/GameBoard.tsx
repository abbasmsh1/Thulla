import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { GameStateWithHand, Card as CardType, SUIT_SYMBOLS } from '../types/game';
import { Card } from './Card';
import { PlayerHand } from './PlayerHand';
import { PlayerAvatar } from './PlayerAvatar';
import { EmojiReactions } from './EmojiReactions';
import { useGameSounds } from '../hooks/useGameSounds';

interface EmojiReaction {
  id: string;
  emoji: string;
  playerId: string;
  timestamp: number;
}

interface GameBoardProps {
  gameState: GameStateWithHand;
  onPlayCard: (card: CardType) => void;
  onSendReaction?: (emoji: string) => void;
  reactions?: EmojiReaction[];
  isConnected?: boolean;
  onReconnect?: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  onPlayCard,
  onSendReaction,
  reactions = [],
  isConnected = true,
  onReconnect
}) => {
  const { players, current_player_id, pile, lead_suit, phase, winner_id, passed_pile_count } = gameState;
  const myId = gameState.your_id;
  const myHand = gameState.your_hand || [];
  const validPlays = gameState.valid_plays || [];
  const [pilePassed, setPilePassed] = useState(false);
  const [thullaAlert] = useState(false);

  const { playCardFlip, playWinTrick, playVictory, playShuffle } = useGameSounds();

  const [prevPileLength, setPrevPileLength] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || window.innerHeight <= 600);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Play sounds when pile changes
  useEffect(() => {
    if (pile.length > prevPileLength) {
      playCardFlip();
    } else if (pile.length === 0 && prevPileLength === players.length && gameStarted) {
      playWinTrick();
    }
    setPrevPileLength(pile.length);
  }, [pile.length, prevPileLength, players.length, playCardFlip, playWinTrick, gameStarted]);

  // Flash "Pile Passed" banner when passed_pile_count increases
  const [prevPassedCount, setPrevPassedCount] = useState(passed_pile_count || 0);
  useEffect(() => {
    if ((passed_pile_count || 0) > prevPassedCount) {
      setPilePassed(true);
      setPrevPassedCount(passed_pile_count || 0);
      const t = window.setTimeout(() => setPilePassed(false), 2500);
      return () => window.clearTimeout(t);
    }
  }, [passed_pile_count, prevPassedCount]);

  // Play shuffle sound on game start
  useEffect(() => {
    if (phase === 'playing' && !gameStarted) {
      playShuffle();
      setGameStarted(true);
    }
  }, [phase, gameStarted, playShuffle]);

  // Play victory on game over
  useEffect(() => {
    if (phase === 'finished' && winner_id) {
      playVictory();
    }
  }, [phase, winner_id, playVictory]);

  // Get my player object
  const me = players.find(p => p.id === myId);
  const opponents = players.filter(p => p.id !== myId);

  // Position opponents
  const getOpponentPosition = (index: number): 'left' | 'right' | 'top' => {
    const positions: ('left' | 'right' | 'top')[] = ['left', 'top', 'right'];
    return positions[index % 3];
  };

  // Calculate player positions for emoji reactions (percentage-based)
  const playerPositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    if (me) {
      positions[me.id] = { x: 50, y: 85 };
    }
    opponents.forEach((opponent, index) => {
      const pos = getOpponentPosition(index);
      switch (pos) {
        case 'left':
          positions[opponent.id] = { x: 15, y: 50 };
          break;
        case 'right':
          positions[opponent.id] = { x: 85, y: 50 };
          break;
        case 'top':
          positions[opponent.id] = { x: 50, y: 15 };
          break;
      }
    });
    return positions;
  }, [me, opponents]);

  // Handle sending reaction
  const handleSendReaction = useCallback((emoji: string) => {
    if (onSendReaction) {
      onSendReaction(emoji);
    }
  }, [onSendReaction]);

  if (phase === 'finished' && winner_id) {
    const winner = players.find(p => p.id === winner_id);
    const isMe = winner_id === myId;

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: `
          radial-gradient(ellipse at 50% 30%, rgba(212, 175, 55, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 70%, rgba(139, 0, 0, 0.2) 0%, transparent 50%),
          linear-gradient(180deg, #0a0a0f 0%, #12121a 50%, #0a0a0f 100%)
        `,
        padding: '20px'
      }}>
        {/* Animated particles */}
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: Array(50).fill(0).map(() =>
            `radial-gradient(2px 2px at ${Math.random() * 100}% ${Math.random() * 100}%, rgba(212, 175, 55, ${0.3 + Math.random() * 0.5}), transparent)`
          ).join(','),
          animation: 'starsFloat 50s linear infinite',
          pointerEvents: 'none'
        }} />

        <div style={{
          animation: 'victoryPulse 2s ease-in-out infinite',
          textAlign: 'center',
          position: 'relative',
          zIndex: 10
        }}>
          <div style={{
            fontSize: '80px',
            marginBottom: '20px',
            filter: 'drop-shadow(0 0 30px rgba(212, 175, 55, 0.6))'
          }}>
            {isMe ? '👑' : '🏆'}
          </div>

          <h1 style={{
            fontSize: '56px',
            margin: '0 0 15px 0',
            fontFamily: 'Cormorant Garamond, serif',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #f4d03f 0%, #d4af37 50%, #8b6914 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))'
          }}>
            {isMe ? 'Victory!' : 'Defeated'}
          </h1>

          {winner && (
            <div style={{ marginBottom: '40px' }}>
              <PlayerAvatar name={winner.name} size={100} />
              <h2 style={{
                marginTop: '20px',
                fontSize: '32px',
                fontFamily: 'Cormorant Garamond, serif',
                color: '#fef9e7',
                textShadow: '0 2px 4px rgba(0,0,0,0.5)'
              }}>
                {winner.name}
              </h2>
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '18px 48px',
              fontSize: '16px',
              fontWeight: 600,
              fontFamily: 'Montserrat, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              backgroundColor: 'transparent',
              color: '#d4af37',
              border: '2px solid #d4af37',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(212, 175, 55, 0.3), inset 0 1px 0 rgba(212, 175, 55, 0.2)',
              transition: 'all 0.3s ease',
              background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(212, 175, 55, 0.1) 100%)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px) scale(1.05)';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(212, 175, 55, 0.5), inset 0 1px 0 rgba(212, 175, 55, 0.3)';
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(212, 175, 55, 0.3) 0%, rgba(212, 175, 55, 0.2) 100%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(212, 175, 55, 0.3), inset 0 1px 0 rgba(212, 175, 55, 0.2)';
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(212, 175, 55, 0.1) 100%)';
            }}
          >
            {isMe ? '🎮 Play Again' : '🔄 Rematch'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{
        position: 'relative',
        width: '100%',
        minHeight: isMobile ? '100vh' : '100vh',
        maxHeight: isMobile ? '100vh' : 'none',
        background: 'transparent',
        overflow: isMobile ? 'auto' : 'hidden',
        fontFamily: '"Montserrat", -apple-system, BlinkMacSystemFont, sans-serif',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Subtle felt texture overlay with pattern */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%),
            repeating-linear-gradient(
              45deg,
              rgba(212, 175, 55, 0.02) 0px,
              transparent 1px,
              transparent 8px,
              rgba(212, 175, 55, 0.02) 9px
            )
          `,
          pointerEvents: 'none',
          zIndex: 1
        }} />

        {/* Decorative border */}
        <div style={{
          position: 'absolute',
          inset: isMobile ? '8px' : '15px',
          borderRadius: isMobile ? '12px' : '20px',
          border: '1px solid rgba(212, 175, 55, 0.1)',
          pointerEvents: 'none',
          zIndex: 2
        }} />

        {/* Header with Lead Suit */}
        <div style={{
          position: 'absolute',
          top: '25px',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          zIndex: 10
        }}>
          {/* Connection Status */}
          <div style={{
            position: 'absolute',
            top: '-35px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: isConnected ? 'rgba(39, 174, 96, 0.9)' : 'rgba(196, 30, 58, 0.9)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 500,
            backdropFilter: 'blur(10px)',
            border: `1px solid ${isConnected ? 'rgba(39, 174, 96, 0.3)' : 'rgba(196, 30, 58, 0.3)'}`,
            boxShadow: `0 2px 10px ${isConnected ? 'rgba(39, 174, 96, 0.3)' : 'rgba(196, 30, 58, 0.3)'}`
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isConnected ? '#2ecc71' : '#e74c3c',
              animation: isConnected ? 'pulse 2s infinite' : 'none'
            }} />
            {isConnected ? 'Connected' : 'Disconnected'}
            {!isConnected && onReconnect && (
              <button
                onClick={onReconnect}
                style={{
                  marginLeft: '8px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  fontFamily: 'Montserrat, sans-serif'
                }}
              >
                Reconnect
              </button>
            )}
          </div>

          <div className="glass-panel" style={{
            padding: '16px 40px',
            minWidth: '280px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(212, 175, 55, 0.2)'
          }}>
            <h2 style={{
              margin: 0,
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: '32px',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 50%, #d4af37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '4px',
              textTransform: 'uppercase'
            }}>
              Thulla
            </h2>

            {lead_suit && (
              <div style={{
                marginTop: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '8px 16px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '20px',
                border: '1px solid rgba(212, 175, 55, 0.3)'
              }}>
                <span style={{
                  color: '#95a5a6',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '2px'
                }}>
                  Lead Suit
                </span>
                <span style={{
                  fontSize: '32px',
                  color: lead_suit === 'hearts' || lead_suit === 'diamonds' ? '#c41e3a' : '#1a1a2e',
                  filter: 'drop-shadow(0 0 8px rgba(212, 175, 55, 0.5))'
                }}>
                  {SUIT_SYMBOLS[lead_suit]}
                </span>
              </div>
            )}

            {!lead_suit && phase === 'playing' && (
              <div style={{
                color: '#7f8c8d',
                fontSize: '13px',
                marginTop: '8px',
                fontStyle: 'italic',
                fontFamily: 'Cormorant Garamond, serif'
              }}>
                Waiting for first card...
              </div>
            )}

            {(passed_pile_count || 0) > 0 && (
              <div style={{
                marginTop: '10px',
                fontSize: '12px',
                color: '#2ecc71',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '6px 14px',
                background: 'rgba(46, 204, 113, 0.15)',
                borderRadius: '15px',
                border: '1px solid rgba(46, 204, 113, 0.3)'
              }}>
                <span>✓</span>
                <span>{passed_pile_count} pile{passed_pile_count !== 1 ? 's' : ''} passed</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Opponents ── */}
        {isMobile ? (
          // Mobile layout: horizontal opponents bar at top
          <div style={{
            position: 'relative',
            width: '100%',
            padding: '10px',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.3)',
            borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
            zIndex: 10
          }}>
            {opponents.map((opponent, index) => (
              <div key={opponent.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <PlayerAvatar
                  name={opponent.name}
                  isCurrentPlayer={opponent.id === current_player_id}
                  size={48}
                />
                <div style={{ textAlign: 'center', fontSize: '12px' }}>
                  <div style={{
                    color: '#fef9e7',
                    fontWeight: 600,
                    fontSize: '11px'
                  }}>
                    {opponent.name}
                  </div>
                  <div style={{
                    color: opponent.id === current_player_id ? '#d4af37' : 'rgba(254, 249, 231, 0.6)',
                    fontSize: '10px'
                  }}>
                    {opponent.card_count} cards
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Desktop layout: positioned opponents
          opponents.map((opponent, index) => (
            <div
              key={opponent.id}
              style={{
                position: 'absolute',
                ...(getOpponentPosition(index) === 'left' && {
                  left: '40px',
                  top: '50%',
                  transform: 'translateY(-50%)'
                }),
                ...(getOpponentPosition(index) === 'right' && {
                  right: '40px',
                  top: '50%',
                  transform: 'translateY(-50%)'
                }),
                ...(getOpponentPosition(index) === 'top' && {
                  top: '100px',
                  left: '50%',
                  transform: 'translateX(-50%)'
                })
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <PlayerAvatar
                  name={opponent.name}
                  isCurrentPlayer={opponent.id === current_player_id}
                  size={64}
                />
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    color: '#fef9e7',
                  fontSize: '15px',
                  fontWeight: 600,
                  fontFamily: 'Cormorant Garamond, serif',
                  textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                }}>
                  {opponent.name}
                  {opponent.id === current_player_id && (
                    <span style={{ marginLeft: '8px', color: '#d4af37' }}>🎯</span>
                  )}
                </div>
                <div style={{
                  backgroundColor: 'rgba(212, 175, 55, 0.15)',
                  padding: '5px 14px',
                  borderRadius: '15px',
                  marginTop: '6px',
                  fontSize: '12px',
                  color: '#d4af37',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 500
                }}>
                  {opponent.card_count} cards
                </div>
              </div>
            </div>
          ))
        )}

        {/* ── Pile Passed Banner ── */}
        {pilePassed && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 100,
            pointerEvents: 'none',
            animation: 'pilePassedFade 2.5s ease-in-out forwards'
          }}>
            <div className="glass-panel" style={{
              background: 'linear-gradient(135deg, rgba(39, 174, 96, 0.9) 0%, rgba(46, 204, 113, 0.85) 100%)',
              border: '2px solid rgba(255,255,255,0.3)',
              padding: '28px 60px',
              textAlign: 'center',
              boxShadow: '0 10px 40px rgba(46, 204, 113, 0.4), 0 0 60px rgba(46, 204, 113, 0.2)'
            }}>
              <div style={{ fontSize: '42px', marginBottom: '8px' }}>✓</div>
              <div style={{
                color: '#ffffff',
                fontSize: '24px',
                fontWeight: 700,
                fontFamily: 'Cormorant Garamond, serif',
                letterSpacing: '2px',
                textTransform: 'uppercase'
              }}>
                Pile Passed
              </div>
              <div style={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: '14px',
                marginTop: '6px',
                fontFamily: 'Montserrat, sans-serif'
              }}>
                All players followed suit
              </div>
            </div>
          </div>
        )}

        {/* ── Thulla Alert Banner ── */}
        {thullaAlert && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 100,
            pointerEvents: 'none',
            animation: 'thullaShock 2s ease-in-out forwards'
          }}>
            <div className="glass-panel" style={{
              background: 'linear-gradient(135deg, rgba(196, 30, 58, 0.95) 0%, rgba(139, 0, 0, 0.9) 100%)',
              border: '2px solid rgba(255, 100, 100, 0.5)',
              padding: '30px 70px',
              textAlign: 'center',
              boxShadow: '0 10px 50px rgba(196, 30, 58, 0.6), 0 0 80px rgba(196, 30, 58, 0.3)'
            }}>
              <div style={{
                color: '#ffffff',
                fontSize: '32px',
                fontWeight: 800,
                fontFamily: 'Cormorant Garamond, serif',
                letterSpacing: '6px',
                textTransform: 'uppercase',
                textShadow: '0 2px 8px rgba(0,0,0,0.5)'
              }}>
                ⚡ THULLA! ⚡
              </div>
              <div style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: '14px',
                marginTop: '8px',
                fontFamily: 'Montserrat, sans-serif',
                letterSpacing: '1px'
              }}>
                Betrayal detected
              </div>
            </div>
          </div>
        )}

        {/* Center Pile Area */}
        <div style={{
          position: 'absolute',
          top: isMobile ? '45%' : '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: isMobile ? '280px' : '320px',
          height: isMobile ? '280px' : '320px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 5
        }}>
          {/* Decorative plate */}
          <div style={{
            width: isMobile ? '200px' : '240px',
            height: isMobile ? '200px' : '240px',
            borderRadius: '50%',
            background: `
              radial-gradient(circle, rgba(212, 175, 55, 0.1) 0%, transparent 60%),
              repeating-conic-gradient(
                from 0deg,
                rgba(212, 175, 55, 0.05) 0deg 10deg,
                transparent 10deg 20deg
              )
            `,
            border: '3px solid rgba(212, 175, 55, 0.2)',
            boxShadow: `
              0 0 0 1px rgba(212, 175, 55, 0.1),
              0 10px 40px rgba(0,0,0,0.5),
              inset 0 0 30px rgba(0,0,0,0.3)
            `,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}>
            {/* Inner decorative ring */}
            <div style={{
              width: isMobile ? '150px' : '180px',
              height: isMobile ? '150px' : '180px',
              borderRadius: '50%',
              border: '2px dashed rgba(212, 175, 55, 0.15)',
              position: 'absolute',
              animation: 'spin 60s linear infinite'
            }} />

            {pile.length > 0 ? (
              <>
                {pile.map((playedCard, index) => {
                  const angle = (index - pile.length / 2) * 15;
                  const offset = index * 2.5;
                  const isTopCard = index === pile.length - 1;

                  return (
                    <div
                      key={index}
                      style={{
                        position: 'absolute',
                        transform: `rotate(${angle}deg) translateY(-${offset}px)`,
                        transition: isTopCard ? 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'all 0.3s ease-out',
                        zIndex: index
                      }}
                    >
                      <Card
                        card={playedCard.card}
                        isPlayable={false}
                        style={{
                          width: isMobile ? '65px' : '75px',
                          height: isMobile ? '95px' : '110px',
                          boxShadow: isTopCard
                            ? '0 8px 25px rgba(0,0,0,0.5), 0 0 0 2px rgba(212, 175, 55, 0.4)'
                            : '0 4px 12px rgba(0,0,0,0.3)'
                        }}
                      />
                    </div>
                  );
                })}
                <div style={{
                  position: 'absolute',
                  bottom: '-45px',
                  color: '#d4af37',
                  fontSize: '13px',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 600,
                  letterSpacing: '1px',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  padding: '6px 18px',
                  borderRadius: '20px',
                  border: '1px solid rgba(212, 175, 55, 0.3)'
                }}>
                  {pile.length} / {players.length}
                </div>
              </>
            ) : (
              <div style={{
                color: 'rgba(212, 175, 55, 0.3)',
                fontSize: '13px',
                fontStyle: 'italic',
                fontFamily: 'Cormorant Garamond, serif',
                letterSpacing: '1px'
              }}>
                Play Area
              </div>
            )}
          </div>
        </div>

        {/* Player's Area (bottom) */}
        <div style={{
          position: 'absolute',
          bottom: isMobile ? '15px' : '25px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 20,
          width: isMobile ? '95%' : 'auto',
          maxWidth: isMobile ? '400px' : 'none'
        }}>
          {me && (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '12px' : '16px',
                marginBottom: isMobile ? '8px' : '12px'
              }}>
                <PlayerAvatar
                  name={me.name}
                  isCurrentPlayer={myId === current_player_id}
                  size={isMobile ? 56 : 72}
                />
                <div style={{ textAlign: 'left' }}>
                  <div style={{
                    color: '#fef9e7',
                    fontSize: isMobile ? '16px' : '20px',
                    fontWeight: 700,
                    fontFamily: 'Cormorant Garamond, serif',
                    textShadow: '0 2px 6px rgba(0,0,0,0.8)'
                  }}>
                    {me.name}
                    {myId === current_player_id && (
                      <span style={{ marginLeft: isMobile ? '6px' : '10px', color: '#d4af37' }}>🎯</span>
                    )}
                  </div>
                  <div style={{
                    backgroundColor: 'rgba(212, 175, 55, 0.2)',
                    padding: isMobile ? '4px 12px' : '5px 16px',
                    borderRadius: '15px',
                    marginTop: '4px',
                    fontSize: isMobile ? '11px' : '13px',
                    color: '#d4af37',
                    border: '1px solid rgba(212, 175, 55, 0.4)',
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 500,
                    display: 'inline-block'
                  }}>
                    {myHand.length} cards remaining
                  </div>
                </div>
              </div>

              <PlayerHand
                cards={myHand}
                validPlays={validPlays}
                isCurrentPlayer={myId === current_player_id}
                onPlayCard={onPlayCard}
              />
            </>
          )}
        </div>

        {/* Emoji Reactions */}
        <EmojiReactions
          onSendReaction={handleSendReaction}
          reactions={reactions}
          playerPositions={playerPositions}
        />
      </div>

      <style>{`
        @keyframes pilePassedFade {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.8) translateY(20px); }
          15%  { opacity: 1; transform: translate(-50%, -50%) scale(1.05) translateY(0); }
          80%  { opacity: 1; transform: translate(-50%, -50%) scale(1) translateY(0); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.95) translateY(-20px); }
        }

        @keyframes thullaShock {
          0% { transform: translate(-50%, -50%) scale(0.5) rotate(-10deg); opacity: 0; }
          10% { transform: translate(-50%, -50%) scale(1.2) rotate(10deg); opacity: 1; }
          15% { transform: translate(-50%, -50%) scale(0.9) rotate(-5deg); }
          20% { transform: translate(-50%, -50%) scale(1.05) rotate(3deg); }
          25% { transform: translate(-50%, -50%) scale(1) rotate(0deg); }
          80% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.1) translateY(-30px); }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes victoryPulse {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 30px rgba(212, 175, 55, 0.5));
          }
          50% {
            transform: scale(1.05);
            filter: drop-shadow(0 0 60px rgba(212, 175, 55, 0.8));
          }
        }

        @keyframes starsFloat {
          from { transform: translateY(0); }
          to { transform: translateY(-100vh); }
        }
      `}</style>
    </>
  );
};

export default GameBoard;
