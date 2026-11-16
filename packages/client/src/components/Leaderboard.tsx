import type { LeaderboardRow } from '@quiz/shared';
import { StreakBadge } from './StreakBadge.js';

export function Leaderboard({
  rows,
  twoColumns = false,
  compact = false,
}: {
  rows: LeaderboardRow[];
  twoColumns?: boolean;
  /** Smaller rows without medal colours, for the places below the podium. */
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="muted">No scores yet.</p>;
  }
  return (
    <ol
      className={`leaderboard${twoColumns ? ' leaderboard--two-columns' : ''}${
        compact ? ' leaderboard--compact' : ''
      }`}
    >
      {rows.map((row) => (
        <li key={row.playerId} className="leaderboard__row">
          <span className="leaderboard__rank">{row.rank}</span>
          <span className="leaderboard__name">{row.nickname}</span>
          <StreakBadge streak={row.streak} />
          <PointsDelta points={row.lastPoints} />
          <span className="leaderboard__score">{row.score}</span>
        </li>
      ))}
    </ol>
  );
}

// Points from the last question: green when gained, red when lost to the
// wrong-answer penalty, nothing when unchanged.
export function PointsDelta({ points }: { points: number }) {
  if (points === 0) return null;
  return points > 0 ? (
    <span className="leaderboard__delta">+{points}</span>
  ) : (
    <span className="leaderboard__delta leaderboard__delta--lost">−{-points}</span>
  );
}
