import type { LeaderboardRow } from '@quiz/shared';
import type { CSSProperties } from 'react';

import { pickAwards } from './awards.js';
import { Leaderboard } from './Leaderboard.js';

// Seconds after the final screen opens when each podium place appears.
// Third place goes first so the winner is the last surprise.
export const PODIUM_REVEAL_SECONDS = [2.6, 1.4, 0.2];

// The awards and everyone below the podium appear after the winner.
export const AFTER_PODIUM_SECONDS = 3.6;

const MEDALS = ['🥇', '🥈', '🥉'];

// Left to right on the podium: 2nd, 1st, 3rd.
const PODIUM_ORDER = [1, 0, 2];

function delay(seconds: number): CSSProperties {
  return { animationDelay: `${seconds}s` };
}

export function FinalResults({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return <p className="muted">No scores yet.</p>;
  }
  const rest = rows.slice(3);
  const awards = pickAwards(rows);
  const afterPodium = delay(AFTER_PODIUM_SECONDS);

  return (
    <div className="final-results">
      <ol className="podium" aria-label="Podium">
        {PODIUM_ORDER.filter((place) => rows[place]).map((place) => {
          const row = rows[place];
          return (
            <li
              key={row.playerId}
              className={`podium__place podium__place--${place + 1}`}
              style={delay(PODIUM_REVEAL_SECONDS[place])}
            >
              <span className="podium__name">{row.nickname}</span>
              <span className="podium__score">{row.score}</span>
              <span className="podium__block" aria-hidden="true">
                {MEDALS[place]}
              </span>
            </li>
          );
        })}
      </ol>

      {awards.length > 0 && (
        <ul className="awards" style={afterPodium}>
          {awards.map((award) => (
            <li key={award.title} className="award">
              <span className="award__icon" aria-hidden="true">
                {award.icon}
              </span>
              <span className="award__title">{award.title}</span>
              <span className="award__name">
                {award.nickname}{' '}
                <span className="award__detail">{award.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {rest.length > 0 && (
        <div className="final-results__rest" style={afterPodium}>
          <Leaderboard rows={rest} twoColumns={rest.length > 4} compact />
        </div>
      )}
    </div>
  );
}
