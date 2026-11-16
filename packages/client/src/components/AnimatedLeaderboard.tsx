import type { LeaderboardRow } from '@quiz/shared';
import { useEffect, useState } from 'react';

import { PointsDelta } from './Leaderboard.js';
import {
  easeOutCubic,
  lerpScore,
  orderIds,
  previousScoreOf,
  standingsSignature,
} from './leaderboardAnimation.js';
import { StreakBadge } from './StreakBadge.js';

const ROW_STEP = 72;

const PRE_COUNT_MS = 600;

const COUNT_MS = 1400;

type Stage = 'previous' | 'counting' | 'final';

const medalClass = ['arow--gold', 'arow--silver', 'arow--bronze'];

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function CountingLeaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const [stage, setStage] = useState<Stage>('previous');
  // How far the scores have counted up, from 0 (previous) to 1 (final).
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame: number | null = null;

    const startCounting = () => {
      setStage('counting');
      const startedAt = now();

      const tick = () => {
        const elapsed = Math.min(1, (now() - startedAt) / COUNT_MS);
        setProgress(easeOutCubic(elapsed));

        if (elapsed < 1) {
          frame = requestAnimationFrame(tick);
        } else {
          setStage('final');
        }
      };

      frame = requestAnimationFrame(tick);
    };

    const timer = setTimeout(startCounting, PRE_COUNT_MS);
    return () => {
      clearTimeout(timer);
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, []);

  const order =
    stage === 'final'
      ? orderIds(rows, (row) => row.score)
      : orderIds(rows, previousScoreOf);
  const positionOf = new Map(order.map((id, index) => [id, index]));

  return (
    <div
      className="leaderboard leaderboard--animated"
      style={{ height: rows.length * ROW_STEP }}
    >
      {rows.map((row) => {
        const position = positionOf.get(row.playerId) ?? 0;
        const isTopThree = stage === 'final' && position < 3;
        return (
          <div
            key={row.playerId}
            className={`arow ${isTopThree ? medalClass[position] : ''}`}
            style={{
              transform: `translateY(${position * ROW_STEP}px)`,
              transition: stage === 'previous' ? 'none' : 'transform 0.7s ease',
            }}
          >
            <span className="leaderboard__rank">{position + 1}</span>
            <span className="leaderboard__name">{row.nickname}</span>
            {stage !== 'previous' && <StreakBadge streak={row.streak} />}
            {stage !== 'previous' && <PointsDelta points={row.lastPoints} />}
            <span className="leaderboard__score">
              {lerpScore(previousScoreOf(row), row.score, progress)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AnimatedLeaderboard({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return <p className="muted">No scores yet.</p>;
  }
  // New standings remount the board, so the count-up starts over. Other
  // rebroadcasts (a reconnect, a reaction) keep the running animation.
  return <CountingLeaderboard key={standingsSignature(rows)} rows={rows} />;
}
