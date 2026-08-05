import type { LeaderboardRow } from '@quiz/shared';

/** Ordered standings, highest score first. */
export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return <p className="muted">No scores yet.</p>;
  }
  return (
    <ol className="leaderboard">
      {rows.map((row) => (
        <li key={row.playerId} className="leaderboard__row">
          <span className="leaderboard__rank">{row.rank}</span>
          <span className="leaderboard__name">{row.nickname}</span>
          {row.lastPoints > 0 && (
            <span className="leaderboard__delta">+{row.lastPoints}</span>
          )}
          <span className="leaderboard__score">{row.score}</span>
        </li>
      ))}
    </ol>
  );
}
