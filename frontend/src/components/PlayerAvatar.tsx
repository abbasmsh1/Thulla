import React from 'react';

interface PlayerAvatarProps {
  name: string;
  size?: number;
  isCurrentPlayer?: boolean;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  name,
  size = 48,
  isCurrentPlayer = false
}) => {
  // Generate a consistent avatar URL based on player name
  const avatarUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;

  return (
    <div
      style={{
        position: 'relative',
        width: size + 10,
        height: size + 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {/* Outer glow ring for current player */}
      {isCurrentPlayer && (
        <>
          {/* Animated outer ring */}
          <div
            style={{
              position: 'absolute',
              inset: -6,
              borderRadius: '50%',
              border: '2px solid rgba(212, 175, 55, 0.4)',
              boxShadow: '0 0 20px rgba(212, 175, 55, 0.4), inset 0 0 10px rgba(212, 175, 55, 0.2)',
              animation: 'avatarPulse 2s ease-in-out infinite'
            }}
          />
          {/* Inner glow */}
          <div
            style={{
              position: 'absolute',
              inset: -3,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(212, 175, 55, 0.3) 0%, transparent 60%)',
              animation: 'avatarGlow 1.5s ease-in-out infinite'
            }}
          />
        </>
      )}

      {/* Ornate frame */}
      <div
        style={{
          position: 'absolute',
          width: size + 4,
          height: size + 4,
          borderRadius: '50%',
          background: `linear-gradient(135deg,
            rgba(212, 175, 55, 0.3) 0%,
            rgba(139, 105, 20, 0.2) 50%,
            rgba(212, 175, 55, 0.3) 100%)`,
          border: `1px solid ${isCurrentPlayer ? 'rgba(212, 175, 55, 0.6)' : 'rgba(255,255,255,0.2)'}`,
          boxShadow: isCurrentPlayer
            ? '0 4px 15px rgba(212, 175, 55, 0.4), 0 0 30px rgba(212, 175, 55, 0.2)'
            : '0 4px 12px rgba(0,0,0,0.4)',
          zIndex: 2
        }}
      />

      {/* Avatar image */}
      <img
        src={avatarUrl}
        alt={name}
        width={size - 4}
        height={size - 4}
        style={{
          borderRadius: '50%',
          border: `2px solid ${isCurrentPlayer ? '#d4af37' : 'rgba(255,255,255,0.3)'}`,
          backgroundColor: '#1a1a2e',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          position: 'relative',
          zIndex: 3
        }}
      />

      {/* Active turn indicator */}
      {isCurrentPlayer && (
        <div
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: '#1a1a2e',
            border: '2px solid #d4af37',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            animation: 'avatarBounce 1s ease-in-out infinite'
          }}
        >
          <span style={{ fontSize: '10px' }}>⚡</span>
        </div>
      )}

      <style>{`
        @keyframes avatarPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.08);
            opacity: 0.7;
          }
        }

        @keyframes avatarGlow {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }

        @keyframes avatarBounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
      `}</style>
    </div>
  );
};

export default PlayerAvatar;
