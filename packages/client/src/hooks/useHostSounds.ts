import { melodySeconds } from '@quiz/shared';
import type { PublicGameState } from '@quiz/shared';
import { useEffect, useEffectEvent } from 'react';

import { playMelody, sounds } from '../audio.js';
import { REEL_SPIN_SECONDS } from '../components/CategoryReel.js';
import { PODIUM_REVEAL_SECONDS } from '../components/FinalResults.js';

const TICK_FROM_SECONDS = 5;
// Pause before a tune starts and before it plays the second time.
const MELODY_GAP_SECONDS = 1.2;

export function useHostSounds(state: PublicGameState | null): void {
  const phase = state?.phase;
  const questionNumber =
    state?.currentQuestion?.number ?? state?.upcoming?.number ?? 0;
  const endsAt = state?.endsAt ?? null;
  const melody = state?.currentQuestion?.melody;
  const places = Math.min(3, state?.leaderboard.length ?? 0);

  // Sees the latest melody and podium size without them being effect
  // dependencies, so a state rebroadcast within a phase doesn't replay it.
  const playPhaseSound = useEffectEvent(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const stops: (() => void)[] = [];
    switch (phase) {
      case 'intro':
        sounds.reel(REEL_SPIN_SECONDS);
        break;
      case 'question': {
        sounds.questionStart();
        // Tunes play twice so everyone gets a proper listen.
        if (melody) {
          const again = MELODY_GAP_SECONDS * 2 + melodySeconds(melody);
          stops.push(playMelody(melody, MELODY_GAP_SECONDS));
          stops.push(playMelody(melody, again));
        }
        break;
      }
      case 'reveal':
        sounds.reveal();
        break;
      case 'ended':
        for (let place = places - 1; place >= 0; place -= 1) {
          timers.push(
            setTimeout(
              place === 0 ? () => sounds.fanfare() : () => sounds.podiumPlace(),
              PODIUM_REVEAL_SECONDS[place] * 1000,
            ),
          );
        }
        break;
      default:
        break;
    }
    return () => {
      timers.forEach(clearTimeout);
      stops.forEach((stop) => stop());
    };
  });

  useEffect(() => playPhaseSound(), [phase, questionNumber]);

  // Ticks through the start countdown and the last seconds of a question.
  useEffect(() => {
    if ((phase !== 'question' && phase !== 'countdown') || endsAt === null) {
      return undefined;
    }
    let lastSecond = Infinity;
    const timer = setInterval(() => {
      const secondsLeft = Math.ceil((endsAt - Date.now()) / 1000);
      if (secondsLeft === lastSecond) {
        return;
      }
      lastSecond = secondsLeft;
      if (secondsLeft > 0 && secondsLeft <= TICK_FROM_SECONDS) {
        sounds.tick(phase === 'question' && secondsLeft <= 3);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [phase, endsAt]);
}
