import React, { useState } from 'react';
import { Card as CardType, SUIT_SYMBOLS } from '../types/game';

interface CardProps {
  card: CardType;
  isPlayable?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  hidden?: boolean;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({
  card,
  isPlayable = true,
  isSelected = false,
  onClick,
  hidden = false,
  style = {}
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitColor = isRed ? '#c41e3a' : '#1a1a2e';
  const goldAccent = '#d4af37';

  // ── Face-down card ─────────────────────────────────────────────────────────
  if (hidden) {
    return (
      <div
        style={{
          width: '110px',
          height: '165px',
          borderRadius: '14px',
          background: 'linear-gradient(145deg, #1a1a2e 0%, #0d0d1a 100%)',
          border: `2px solid ${goldAccent}`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(212, 175, 55, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          cursor: 'default',
          ...style
        }}
      >
        {/* Ornate border pattern */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          viewBox="0 0 110 165"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern id="cardBackPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M10 0 L20 10 L10 20 L0 10 Z" fill="none" stroke="rgba(212, 175, 55, 0.15)" strokeWidth="0.5"/>
              <circle cx="10" cy="10" r="3" fill="none" stroke="rgba(212, 175, 55, 0.1)" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="110" height="165" fill="url(#cardBackPattern)" />

          {/* Ornate corners */}
          <path d="M0 0 L25 0 L25 8 Q25 12 21 12 L8 12 Q0 12 0 4 Z" fill={goldAccent} opacity="0.3"/>
          <path d="M110 0 L85 0 L85 8 Q85 12 89 12 L102 12 Q110 12 110 4 Z" fill={goldAccent} opacity="0.3"/>
          <path d="M0 165 L25 165 L25 157 Q25 153 21 153 L8 153 Q0 153 0 161 Z" fill={goldAccent} opacity="0.3"/>
          <path d="M110 165 L85 165 L85 157 Q85 153 89 153 L102 153 Q110 153 110 161 Z" fill={goldAccent} opacity="0.3"/>
        </svg>

        {/* Center emblem */}
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          border: `2px solid ${goldAccent}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.2) 0%, transparent 70%)',
          zIndex: 1
        }}>
          <span style={{ fontSize: '28px', opacity: 0.6 }}>♠</span>
        </div>
      </div>
    );
  }

  // ── Face-up card ────────────────────────────────────────────────────────────
  const symbol = SUIT_SYMBOLS[card.suit];

  const elevation = isSelected
    ? '0 25px 50px rgba(0,0,0,0.5), 0 0 0 2px #d4af37, 0 0 30px rgba(212, 175, 55, 0.5)'
    : isHovered && isPlayable
      ? `0 18px 35px rgba(0,0,0,0.45), 0 0 0 2px ${goldAccent}, 0 0 20px rgba(212, 175, 55, 0.4)`
      : '0 6px 16px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.2)';

  const transform = isSelected
    ? 'translateY(-30px) scale(1.08)'
    : isHovered && isPlayable
      ? 'translateY(-35px) scale(1.12)'
      : 'none';

  return (
    <div
      onClick={isPlayable ? onClick : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '110px',
        height: '165px',
        background: 'linear-gradient(160deg, #fef9e7 0%, #f5f0e1 55%, #e8e0c8 100%)',
        borderRadius: '14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 8px',
        boxShadow: elevation,
        cursor: isPlayable ? 'pointer' : 'default',
        opacity: isPlayable ? 1 : 0.7,
        transform,
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        ...style
      }}
    >
      {/* Subtle inner border */}
      <div style={{
        position: 'absolute',
        inset: '4px',
        borderRadius: '10px',
        border: `1px solid ${isRed ? 'rgba(196, 30, 58, 0.15)' : 'rgba(26, 26, 46, 0.15)'}`,
        pointerEvents: 'none',
      }} />

      {/* Playable highlight */}
      {isPlayable && !isSelected && (
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '14px',
          border: `2px solid ${goldAccent}`,
          boxShadow: `inset 0 0 12px rgba(212, 175, 55, 0.3)`,
          pointerEvents: 'none',
          animation: 'pulse 2s ease-in-out infinite'
        }} />
      )}

      {/* Gloss sheen */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '55%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 100%)',
        pointerEvents: 'none',
        zIndex: 5
      }} />

      {/* Corner decoration */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: '30px', height: '30px' }}
        viewBox="0 0 30 30"
      >
        <path
          d="M0 0 L20 0 L20 6 Q20 10 16 10 L6 10 Q0 10 0 4 Z"
          fill={goldAccent}
          opacity="0.5"
        />
      </svg>
      <svg
        style={{ position: 'absolute', bottom: 0, right: 0, width: '30px', height: '30px', transform: 'rotate(180deg)' }}
        viewBox="0 0 30 30"
      >
        <path
          d="M0 0 L20 0 L20 6 Q20 10 16 10 L6 10 Q0 10 0 4 Z"
          fill={goldAccent}
          opacity="0.5"
        />
      </svg>

      {/* Top-left corner */}
      <div style={{
        alignSelf: 'flex-start',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1,
        gap: '2px',
        zIndex: 10,
        paddingLeft: '4px'
      }}>
        <span style={{
          fontSize: '26px',
          fontWeight: '700',
          color: suitColor,
          fontFamily: '"Cormorant Garamond", Georgia, serif',
          letterSpacing: '-0.5px',
          lineHeight: 1,
          textShadow: '0 1px 0 rgba(255,255,255,0.5)'
        }}>
          {card.rank}
        </span>
        <span style={{
          fontSize: '20px',
          lineHeight: 1,
          color: suitColor,
          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))'
        }}>
          {symbol}
        </span>
      </div>

      {/* Centre pip - Large SVG suit symbol */}
      <div style={{
        width: '56px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}>
        <svg viewBox="0 0 100 100" width="56" height="56">
          <defs>
            <linearGradient id={`suitGrad-${card.suit}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={suitColor} stopOpacity="1" />
              <stop offset="100%" stopColor={suitColor} stopOpacity="0.8" />
            </linearGradient>
            <filter id="suitShadow">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
            </filter>
          </defs>

          {card.suit === 'hearts' && (
            <path
              d="M50 88 C20 60 0 40 0 25 C0 10 12 0 25 0 C35 0 44 6 50 15 C56 6 65 0 75 0 C88 0 100 10 100 25 C100 40 80 60 50 88 Z"
              fill={`url(#suitGrad-${card.suit})`}
              filter="url(#suitShadow)"
            />
          )}

          {card.suit === 'diamonds' && (
            <path
              d="M50 0 C70 25 90 50 100 65 C100 85 80 100 50 100 C20 100 0 85 0 65 C10 50 30 25 50 0 Z"
              fill={`url(#suitGrad-${card.suit})`}
              filter="url(#suitShadow)"
            />
          )}

          {card.suit === 'clubs' && (
            <g fill={suitColor} filter="url(#suitShadow)">
              <circle cx="30" cy="35" r="22" />
              <circle cx="70" cy="35" r="22" />
              <circle cx="50" cy="15" r="22" />
              <path d="M45 55 L55 55 L55 85 L45 85 Z" />
              <path d="M35 85 L65 85 L50 100 Z" />
            </g>
          )}

          {card.suit === 'spades' && (
            <g fill={suitColor} filter="url(#suitShadow)">
              <path d="M50 0 C70 30 90 50 90 70 C90 90 75 100 50 100 C25 100 10 90 10 70 C10 50 30 30 50 0 Z" />
              <path d="M45 75 L55 75 L55 95 L45 95 Z" />
              <path d="M35 95 L65 95 L50 100 Z" />
            </g>
          )}
        </svg>
      </div>

      {/* Bottom-right corner (rotated) */}
      <div style={{
        alignSelf: 'flex-end',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1,
        gap: '2px',
        transform: 'rotate(180deg)',
        zIndex: 10,
        paddingRight: '4px'
      }}>
        <span style={{
          fontSize: '26px',
          fontWeight: '700',
          color: suitColor,
          fontFamily: '"Cormorant Garamond", Georgia, serif',
          letterSpacing: '-0.5px',
          lineHeight: 1,
          textShadow: '0 1px 0 rgba(255,255,255,0.5)'
        }}>
          {card.rank}
        </span>
        <span style={{
          fontSize: '20px',
          lineHeight: 1,
          color: suitColor,
          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))'
        }}>
          {symbol}
        </span>
      </div>
    </div>
  );
};

export default Card;
