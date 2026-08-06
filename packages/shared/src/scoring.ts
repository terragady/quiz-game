import { BASE_POINTS } from './constants.js';

export interface ScoreInput {
  correct: boolean;
  timeRemainingMs: number;
  questionDurationMs: number;
  basePoints?: number;
}

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
