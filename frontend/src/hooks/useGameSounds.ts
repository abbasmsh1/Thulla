import { useCallback, useRef } from 'react';

export function useGameSounds() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  const playCardFlip = useCallback(() => {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  }, []);

  const playShuffle = useCallback(() => {
    const ctx = getAudioContext();
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.5);
  }, []);

  const playWinTrick = useCallback(() => {
    const ctx = getAudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C major chord

    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = freq;
      oscillator.type = 'sine';

      const startTime = ctx.currentTime + i * 0.05;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.3);
    });
  }, []);

  const playVictory = useCallback(() => {
    const ctx = getAudioContext();
    const melody = [
      { freq: 523.25, duration: 0.2 },
      { freq: 659.25, duration: 0.2 },
      { freq: 783.99, duration: 0.2 },
      { freq: 1046.50, duration: 0.4 },
      { freq: 783.99, duration: 0.2 },
      { freq: 1046.50, duration: 0.6 }
    ];

    let currentTime = ctx.currentTime;
    melody.forEach((note) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = note.freq;
      oscillator.type = 'triangle';

      gainNode.gain.setValueAtTime(0.2, currentTime);
      gainNode.gain.setValueAtTime(0.2, currentTime + note.duration - 0.05);
      gainNode.gain.linearRampToValueAtTime(0, currentTime + note.duration);

      oscillator.start(currentTime);
      oscillator.stop(currentTime + note.duration);

      currentTime += note.duration;
    });
  }, []);

  const playError = useCallback(() => {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(150, ctx.currentTime);
    oscillator.type = 'sawtooth';

    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  }, []);

  return {
    playCardFlip,
    playShuffle,
    playWinTrick,
    playVictory,
    playError
  };
}
