import React, { useState, useCallback } from 'react';

const EMOJI_OPTIONS = ['😂', '😮', '👏', '🔥', '😢', '🤔', '🎉', '🙌', '💪', '🤯'];

interface EmojiReaction {
  id: string;
  emoji: string;
  playerId: string;
  timestamp: number;
}

interface EmojiReactionsProps {
  onSendReaction: (emoji: string) => void;
  reactions: EmojiReaction[];
  playerPositions: Record<string, { x: number; y: number }>;
}

export const EmojiReactions: React.FC<EmojiReactionsProps> = ({
  onSendReaction,
  reactions,
  playerPositions
}) => {
  const [showPicker, setShowPicker] = useState(false);

  const handleEmojiSelect = useCallback((emoji: string) => {
    onSendReaction(emoji);
    setShowPicker(false);
  }, [onSendReaction]);

  return (
    <>
      {/* Floating reactions */}
      {reactions.map((reaction) => {
        const pos = playerPositions[reaction.playerId] || { x: 50, y: 50 };
        return (
          <div
            key={reaction.id}
            style={{
              position: 'fixed',
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: 'translate(-50%, -80%)',
              fontSize: '36px',
              pointerEvents: 'none',
              animation: 'emojiFloatUp 2s ease-out forwards',
              zIndex: 1000,
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))'
            }}
          >
            {reaction.emoji}
          </div>
        );
      })}

      {/* Reaction button and picker */}
      <div style={{
        position: 'fixed',
        bottom: '140px',
        right: '25px',
        zIndex: 100
      }}>
        {showPicker && (
          <div
            style={{
              position: 'absolute',
              bottom: '55px',
              right: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '10px',
              padding: '16px',
              backgroundColor: 'rgba(10, 10, 15, 0.95)',
              borderRadius: '16px',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(212, 175, 55, 0.1)',
              animation: 'pickerFadeIn 0.25s ease-out',
              backdropFilter: 'blur(10px)'
            }}
          >
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiSelect(emoji)}
                style={{
                  fontSize: '24px',
                  padding: '10px',
                  backgroundColor: 'transparent',
                  border: '1px solid transparent',
                  cursor: 'pointer',
                  borderRadius: '10px',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.4)';
                  e.currentTarget.style.transform = 'scale(1.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowPicker(!showPicker)}
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.9) 0%, rgba(139, 105, 20, 0.8) 100%)',
            border: '2px solid rgba(212, 175, 55, 0.5)',
            cursor: 'pointer',
            fontSize: '26px',
            boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4), 0 0 20px rgba(212, 175, 55, 0.2)',
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.12) rotate(5deg)';
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(212, 175, 55, 0.6), 0 0 30px rgba(212, 175, 55, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(212, 175, 55, 0.4), 0 0 20px rgba(212, 175, 55, 0.2)';
          }}
        >
          💬
        </button>
      </div>

      <style>{`
        @keyframes emojiFloatUp {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.3);
          }
          15% {
            opacity: 1;
            transform: translate(-50%, -80%) scale(1.2);
          }
          30% {
            transform: translate(-50%, -80%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -200%) scale(1.1);
          }
        }

        @keyframes pickerFadeIn {
          from {
            opacity: 0;
            transform: translateY(15px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
};

export default EmojiReactions;
