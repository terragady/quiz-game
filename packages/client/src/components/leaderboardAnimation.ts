import type { LeaderboardRow } from '@quiz/shared';

/** The score a player had before the most recently revealed question. */
export function previousScoreOf(row: LeaderboardRow): number {
  return Math.max(0, row.score - row.lastPoints);
}

/**
 * Order player ids highest-score-first using the given score accessor, with a
 * stable, deterministic tie-break on nickname so equal scores don't jump around
 * between the "before" and "after" orderings.
 */
export function orderIds(
  rows: LeaderboardRow[],
  scoreOf: (row: LeaderboardRow) => number,
): string[] {
  return [...rows]
    .sort(
      (a, b) =>
        scoreOf(b) - scoreOf(a) || a.nickname.localeCompare(b.nickname),
    )
    .map((row) => row.playerId);
}

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/** Ease-out cubic, for a lively count-up that settles smoothly. */
export function easeOutCubic(t: number): number {
  const inv = 1 - clamp01(t);
  return 1 - inv * inv * inv;
}

/** Integer interpolation between two scores at progress `t` (0..1). */
export function lerpScore(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * clamp01(t));
}

/** A signature that changes whenever the scored standings change. */
export function standingsSignature(rows: LeaderboardRow[]): string {
  return rows
    .map((row) => `${row.playerId}:${row.score}:${row.lastPoints}`)
    .join('|');
}
