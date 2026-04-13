import React from 'react';
import { Card as CardType } from '../types/game';
import { Card } from './Card';

interface PlayerHandProps {
  cards: CardType[];
  validPlays: CardType[];
  isCurrentPlayer: boolean;
  onPlayCard: (card: CardType) => void;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  cards,
  validPlays,
  isCurrentPlayer,
  onPlayCard
}) => {
  if (!cards || cards.length === 0) {
    return (
      <div style={{
        padding: '50px',
        textAlign: 'center',
        color: 'rgba(254, 249, 231, 0.5)',
        fontSize: '18px',
        fontStyle: 'italic',
        fontFamily: 'Cormorant Garamond, serif',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: '16px',
        border: '1px solid rgba(212, 175, 55, 0.2)'
      }}>
        ✨ All cards played
      </div>
    );
  }

  const isValidPlay = (card: CardType): boolean => {
    return validPlays.some(
      valid => valid.suit === card.suit && valid.rank === card.rank
    );
  };

  // Calculate fan layout with improved mathematics
  const getCardStyle = (index: number, total: number): React.CSSProperties => {
    const maxAngle = Math.min(20, total * 1.8);
    const angleStep = total > 1 ? (maxAngle * 2) / (total - 1) : 0;
    const rotation = total > 1 ? -maxAngle + (angleStep * index) : 0;

    const verticalOffset = Math.abs(rotation) * 0.6;

    const maxSpacing = 50;
    const spacing = Math.max(25, Math.min(maxSpacing, 550 / total));
    const startX = -((total - 1) * spacing) / 2;
    const horizontalOffset = startX + (index * spacing);

    return {
      transform: `translateX(${horizontalOffset}px) translateY(${verticalOffset}px) rotate(${rotation}deg)`,
      transformOrigin: 'bottom center',
      zIndex: index,
      transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), z-index 0s 0.3s'
    };
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '20px',
      marginBottom: '10px'
    }}>
      {/* Turn indicator */}
      {isCurrentPlayer && (
        <div style={{
          fontSize: '14px',
          color: '#d4af37',
          fontWeight: 600,
          fontFamily: 'Montserrat, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: '3px',
          textShadow: '0 2px 4px rgba(0,0,0,0.8)',
          animation: 'pulse 1.5s ease-in-out infinite',
          backgroundColor: 'rgba(212, 175, 55, 0.15)',
          padding: '10px 28px',
          borderRadius: '25px',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          boxShadow: '0 4px 20px rgba(212, 175, 55, 0.2), inset 0 1px 0 rgba(212, 175, 55, 0.1)'
        }}>
          ⚡ Your Turn
        </div>
      )}

      {/* Cards container with improved arc */}
      <div style={{
        position: 'relative',
        height: '220px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        padding: '10px 80px',
        width: '100%',
        marginTop: '-20px'
      }}>
        {cards.map((card, index) => {
          const isValid = isCurrentPlayer && isValidPlay(card);

          return (
            <div
              className="card-wrapper"
              key={`${card.suit}-${card.rank}-${index}`}
              style={{
                position: 'absolute',
                left: '50%',
                marginLeft: '-55px',
                ...getCardStyle(index, cards.length),
                animation: isValid && isCurrentPlayer ? 'validCardGlow 2s ease-in-out infinite' : 'none'
              }}
            >
              {/* Valid play indicator - enhanced */}
              {isValid && (
                <>
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '14px',
                    height: '14px',
                    backgroundColor: '#d4af37',
                    borderRadius: '50%',
                    boxShadow: '0 0 15px #d4af37, 0 0 30px rgba(212, 175, 55, 0.6)',
                    zIndex: 20,
                    animation: 'indicatorPulse 1.5s ease-in-out infinite'
                  }} />
                  {/* Glow ring */}
                  <div style={{
                    position: 'absolute',
                    top: '-18px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: '2px solid rgba(212, 175, 55, 0.5)',
                    boxShadow: '0 0 20px rgba(212, 175, 55, 0.4)',
                    zIndex: 19,
                    animation: 'ringExpand 1.5s ease-out infinite'
                  }} />
                </>
              )}

              <Card
                card={card}
                isPlayable={isValid}
                onClick={() => onPlayCard(card)}
              />
            </div>
          );
        })}
      </div>

      {/* Card count with style */}
      <div style={{
        fontSize: '13px',
        color: '#95a5a6',
        fontFamily: 'Montserrat, sans-serif',
        letterSpacing: '1px',
        textTransform: 'uppercase'
      }}>
        {cards.length} card{cards.length !== 1 ? 's' : ''} in hand
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.85; }
        }

        @keyframes indicatorPulse {
          0%, 100% {
            transform: translateX(-50%) scale(1);
            box-shadow: 0 0 15px #d4af37, 0 0 30px rgba(212, 175, 55, 0.6);
          }
          50% {
            transform: translateX(-50%) scale(1.2);
            box-shadow: 0 0 25px #d4af37, 0 0 50px rgba(212, 175, 55, 0.8);
          }
        }

        @keyframes ringExpand {
          0% {
            transform: translateX(-50%) scale(0.8);
            opacity: 1;
          }
          100% {
            transform: translateX(-50%) scale(1.5);
            opacity: 0;
          }
        }

        @keyframes validCardGlow {
          0%, 100% {
            filter: drop-shadow(0 0 3px rgba(212, 175, 55, 0.4));
          }
          50% {
            filter: drop-shadow(0 0 8px rgba(212, 175, 55, 0.7));
          }
        }
      `}</style>
    </div>
  );
};

export default PlayerHand;
