import type { Melody } from '@quiz/shared';
import { useEffect, useRef } from 'react';

import { playMelody, unlockAudio } from '../audio.js';

// Shown on the host screen for name-that-tune questions. The tune plays by
// itself when the question opens; this lets the host play it again.
export function TunePlayer({ melody }: { melody: Melody }) {
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => () => stopRef.current?.(), []);

  async function replay() {
    await unlockAudio();
    stopRef.current?.();
    stopRef.current = playMelody(melody);
  }

  return (
    <div className="tune-player">
      <span className="tune-player__icon" aria-hidden="true">
        ♫
      </span>
      <button type="button" className="btn btn--ghost" onClick={replay}>
        Play the tune again
      </button>
    </div>
  );
}
