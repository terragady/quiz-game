import { BASE_POINTS } from './constants.js';

export interface ScoreInput {
  /** Whether the submitted answer was correct. */
  correct: boolean;
  /** Milliseconds left on the clock when the answer was submitted. */
  timeRemainingMs: number;
  /** Total time allotted for the question, in milliseconds. */
  questionDurationMs: number;
  /** Points for an instant correct answer (defaults to BASE_POINTS). */
  basePoints?: number;
}

/**
 * Speed-based scoring: a correct answer earns between half and full base points,
 * scaled linearly by how much time was left. Wrong answers earn nothing.
 *
 * Instant correct answer -> full points; answer at the buzzer -> half points.
 */
export function calculateScore({
  correct,
  timeRemainingMs,
  questionDurationMs,
  basePoints = BASE_POINTS,
}: ScoreInput): number {
  if (!correct) {
    return 0;
  }

  const fraction =
    questionDurationMs > 0
      ? clamp(timeRemainingMs / questionDurationMs, 0, 1)
      : 0;

  return Math.round(basePoints * (0.5 + 0.5 * fraction));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
