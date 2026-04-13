import React from 'react';
import { Player } from '../types/game';
import { Card } from './Card';
import { PlayerAvatar } from './PlayerAvatar';

interface OpponentProps {
  player: Player;
  isCurrentPlayer: boolean;
  position: 'left' | 'right' | 'top';
}

export const Opponent: React.FC<OpponentProps> = ({
  player,
  isCurrentPlayer,
  position
}) => {
  const getCardRotation = (): number => {
    switch (position) {
      case 'left':
        return 90;
      case 'right':
        return -90;
      case 'top':
        return 0;
      default:
        return 0;
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px'
    }}>
      {/* Avatar and name */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(10px)',
        padding: '12px 20px',
        borderRadius: '16px',
        border: isCurrentPlayer ? '2px solid #f39c12' : '1px solid rgba(255,255,255,0.1)',
        boxShadow: isCurrentPlayer
          ? '0 0 20px rgba(243,156,18,0.3)'
          : '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        <PlayerAvatar
          name={player.name}
          isCurrentPlayer={isCurrentPlayer}
          size={52}
        />

        <div style={{
          fontSize: '14px',
          color: 'white',
          fontWeight: isCurrentPlayer ? 'bold' : 'normal',
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap'
        }}>
          {player.name}
        </div>

        {/* Card count badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: 'rgba(255,255,255,0.1)',
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '13px',
          color: '#f39c12'
        }}>
          <span>🎴</span>
          <span>{player.card_count}</span>
        </div>
      </div>

      {/* Cards stack */}
      <div style={{
        display: 'flex',
        transform: `rotate(${getCardRotation()}deg)`,
        marginTop: position === 'top' ? '10px' : 0
      }}>
        {Array.from({ length: Math.min(player.card_count, 6) }).map((_, i) => (
          <div
            key={i}
            style={{
              marginLeft: i > 0 ? '-45px' : 0,
              zIndex: i,
              transform: `translateY(${i * 2}px)`
            }}
          >
            <Card
              card={{ suit: 'spades', rank: 'A' }}
              hidden
              style={{
                width: '55px',
                height: '82px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}
            />
          </div>
        ))}

        {/* Show +X if more cards */}
        {player.card_count > 6 && (
          <div style={{
            marginLeft: '10px',
            alignSelf: 'center',
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: 'white',
            padding: '4px 10px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 'bold',
            transform: `rotate(${-getCardRotation()}deg)`
          }}>
            +{player.card_count - 6}
          </div>
        )}
      </div>
    </div>
  );
};

export default Opponent;
