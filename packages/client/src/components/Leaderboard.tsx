import type { LeaderboardRow } from '@quiz/shared';

export function Leaderboard({
  rows,
  twoColumns = false,
}: {
  rows: LeaderboardRow[];
  twoColumns?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="muted">No scores yet.</p>;
  }
  return (
    <ol className={`leaderboard${twoColumns ? ' leaderboard--two-columns' : ''}`}>
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
