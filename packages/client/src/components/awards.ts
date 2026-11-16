import type { LeaderboardRow } from '@quiz/shared';

import { SHOW_STREAK_FROM } from './StreakBadge.js';

export interface Award {
  icon: string;
  title: string;
  nickname: string;
  detail: string;
}

function best(
  rows: LeaderboardRow[],
  read: (stats: NonNullable<LeaderboardRow['stats']>) => number | null,
  direction: 'lowest' | 'highest',
): { row: LeaderboardRow; value: number } | null {
  let winner: { row: LeaderboardRow; value: number } | null = null;
  for (const row of rows) {
    const value = row.stats ? read(row.stats) : null;
    if (value === null) {
      continue;
    }
    const better =
      !winner ||
      (direction === 'lowest' ? value < winner.value : value > winner.value);
    if (better) {
      winner = { row, value };
    }
  }
  return winner;
}

// Picks the end-of-game awards from the final leaderboard. Rows come in rank
// order, so on a tie the better-placed player wins the award.
export function pickAwards(rows: LeaderboardRow[]): Award[] {
  const awards: Award[] = [];

  const fastest = best(rows, (stats) => stats.fastestCorrectMs, 'lowest');
  if (fastest) {
    awards.push({
      icon: '⚡',
      title: 'Fastest finger',
      nickname: fastest.row.nickname,
      detail: `${(fastest.value / 1000).toFixed(1)}s`,
    });
  }

  const sharpest = best(rows, (stats) => stats.correct || null, 'highest');
  if (sharpest) {
    awards.push({
      icon: '🎯',
      title: 'Sharpshooter',
      nickname: sharpest.row.nickname,
      detail: `${sharpest.value} correct`,
    });
  }

  const streak = best(
    rows,
    (stats) => (stats.bestStreak >= SHOW_STREAK_FROM ? stats.bestStreak : null),
    'highest',
  );
  if (streak) {
    awards.push({
      icon: '🔥',
      title: 'Hot streak',
      nickname: streak.row.nickname,
      detail: `${streak.value} in a row`,
    });
  }

  return awards;
}
