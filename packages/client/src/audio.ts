// Small synthesized sound effects for the host screen. Everything is generated
// with WebAudio, so there are no sound files to ship.

import { parseMelody, type Melody } from '@quiz/shared';

const MUTED_KEY = 'quiz.muted';

let context: AudioContext | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTED_KEY, value ? '1' : '0');
  } catch {
    void 0;
  }
  if (value) context?.suspend().catch(() => undefined);
  else void unlockAudio();
}

// Browsers only allow sound after the user has clicked something, so this is
// called from the host's button clicks.
export async function unlockAudio(): Promise<void> {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return;
  context ??= new AudioContext();
  if (context.state === 'suspended' && !muted) {
    await context.resume().catch(() => undefined);
  }
}

interface ToneOptions {
  type?: OscillatorType;
  volume?: number;
  slideTo?: number;
}

function tone(
  frequency: number,
  startIn: number,
  duration: number,
  { type = 'triangle', volume = 0.18, slideTo }: ToneOptions = {},
): OscillatorNode | null {
  if (!context || muted || context.state !== 'running') return null;
  const start = context.currentTime + startIn;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  }
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
  return oscillator;
}

// Plays a "name that tune" melody and returns a function that stops it.
export function playMelody(melody: Melody, startIn = 0): () => void {
  const beatSeconds = 60 / melody.bpm;
  const oscillators: OscillatorNode[] = [];
  let at = startIn;
  for (const note of parseMelody(melody.notes)) {
    const length = note.beats * beatSeconds;
    if (note.frequency !== null) {
      const oscillator = tone(note.frequency, at, length * 0.9, {
        volume: 0.22,
      });
      if (oscillator) oscillators.push(oscillator);
    }
    at += length;
  }
  return () => oscillators.forEach((oscillator) => oscillator.stop());
}

export const sounds = {
  tick(urgent = false): void {
    tone(urgent ? 1320 : 990, 0, 0.06, { type: 'square', volume: 0.05 });
  },
  questionStart(): void {
    tone(660, 0, 0.12, { volume: 0.12 });
    tone(990, 0.08, 0.18, { volume: 0.12 });
  },
  reveal(): void {
    tone(523, 0, 0.14);
    tone(659, 0.1, 0.14);
    tone(784, 0.2, 0.3);
  },
  // Clicks that slow down, matching the category reel's spin.
  reel(spinSeconds: number): void {
    let at = 0;
    let gap = 0.04;
    while (at < spinSeconds) {
      tone(1800, at, 0.03, { type: 'square', volume: 0.03 });
      at += gap;
      gap *= 1.16;
    }
    tone(880, spinSeconds, 0.25, { volume: 0.14 });
  },
  podiumPlace(): void {
    tone(196, 0, 0.25, { type: 'sine', volume: 0.3, slideTo: 98 });
    tone(392, 0.02, 0.2, { volume: 0.08 });
  },
  fanfare(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((frequency, index) => tone(frequency, index * 0.12, 0.25));
    tone(1047, notes.length * 0.12, 0.7, { volume: 0.2 });
    tone(784, notes.length * 0.12, 0.7, { volume: 0.12 });
  },
};
