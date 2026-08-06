import type { LeaderboardRow } from '@quiz/shared';

export function previousScoreOf(row: LeaderboardRow): number {
  return Math.max(0, row.score - row.lastPoints);
}

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

export function easeOutCubic(t: number): number {
  const inv = 1 - clamp01(t);
  return 1 - inv * inv * inv;
}

export function lerpScore(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * clamp01(t));
}

export function standingsSignature(rows: LeaderboardRow[]): string {
  return rows
    .map((row) => `${row.playerId}:${row.score}:${row.lastPoints}`)
    .join('|');
}
