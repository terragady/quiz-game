import { useEffect, useMemo, useRef, useState } from 'react';
import type { LeaderboardRow } from '@quiz/shared';
import {
  easeOutCubic,
  lerpScore,
  orderIds,
  previousScoreOf,
  standingsSignature,
} from './leaderboardAnimation.js';

const ROW_STEP = 72;
const PRE_COUNT_MS = 600;
const COUNT_MS = 1400;

type Stage = 'previous' | 'counting' | 'final';

const medalClass = ['arow--gold', 'arow--silver', 'arow--bronze'];

export function AnimatedLeaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const signature = standingsSignature(rows);

  const finalScores = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.playerId, row.score);
    return map;
  }, [rows, signature]);

  const previousScores = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.playerId, previousScoreOf(row));
    return map;
  }, [rows, signature]);

  const previousOrder = useMemo(
    () => orderIds(rows, previousScoreOf),
    [rows, signature],
  );
  const finalOrder = useMemo(
    () => orderIds(rows, (row) => row.score),
    [rows, signature],
  );

  const [stage, setStage] = useState<Stage>('previous');
  const [displayScores, setDisplayScores] =
    useState<Map<string, number>>(previousScores);

  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    setStage('previous');
    setDisplayScores(previousScores);

    const startCounting = () => {
      setStage('counting');
      const startedAt =
        typeof performance !== 'undefined' ? performance.now() : Date.now();

      const tick = () => {
        const now =
          typeof performance !== 'undefined' ? performance.now() : Date.now();
        const progress = Math.min(1, (now - startedAt) / COUNT_MS);
        const eased = easeOutCubic(progress);

        const next = new Map<string, number>();
        for (const [id, target] of finalScores) {
          next.set(id, lerpScore(previousScores.get(id) ?? 0, target, eased));
        }
        setDisplayScores(next);

        if (progress < 1) {
          frameRef.current = requestAnimationFrame(tick);
        } else {
          setDisplayScores(finalScores);
          setStage('final');
        }
      };

      frameRef.current = requestAnimationFrame(tick);
    };

    const timer = setTimeout(startCounting, PRE_COUNT_MS);
    return () => {
      clearTimeout(timer);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [signature]);

  if (rows.length === 0) {
    return <p className="muted">No scores yet.</p>;
  }

  const order = stage === 'final' ? finalOrder : previousOrder;
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
              transition:
                stage === 'previous' ? 'none' : 'transform 0.7s ease',
            }}
          >
            <span className="leaderboard__rank">{position + 1}</span>
            <span className="leaderboard__name">{row.nickname}</span>
            {stage !== 'previous' && row.lastPoints > 0 && (
              <span className="leaderboard__delta">+{row.lastPoints}</span>
            )}
            <span className="leaderboard__score">
              {displayScores.get(row.playerId) ?? row.score}
            </span>
          </div>
        );
      })}
    </div>
  );
}
