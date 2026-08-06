import { describe, it, expect } from 'vitest';
import type { LeaderboardRow } from '@quiz/shared';
import {
  previousScoreOf,
  orderIds,
  lerpScore,
  easeOutCubic,
  standingsSignature,
} from './leaderboardAnimation.js';

function row(overrides: Partial<LeaderboardRow>): LeaderboardRow {
  return {
    playerId: 'p',
    nickname: 'Player',
    score: 0,
    rank: 1,
    lastPoints: 0,
    ...overrides,
  };
}

describe('previousScoreOf', () => {
  it('subtracts the most recent points from the current score', () => {
    expect(previousScoreOf(row({ score: 1500, lastPoints: 500 }))).toBe(1000);
  });

  it('never returns a negative score', () => {
    expect(previousScoreOf(row({ score: 100, lastPoints: 999 }))).toBe(0);
  });

  it('leaves the score unchanged when no points were awarded', () => {
    expect(previousScoreOf(row({ score: 800, lastPoints: 0 }))).toBe(800);
  });
});

describe('orderIds', () => {
  const rows = [
    row({ playerId: 'a', nickname: 'Ann', score: 300, lastPoints: 300 }),
    row({ playerId: 'b', nickname: 'Bob', score: 500, lastPoints: 0 }),
    row({ playerId: 'c', nickname: 'Cid', score: 500, lastPoints: 400 }),
  ];

  it('orders by the final score, highest first', () => {
    expect(orderIds(rows, (r) => r.score)).toEqual(['b', 'c', 'a']);
  });

  it('orders by the previous score for the pre-count standings', () => {
    // previous scores: a=0, b=500, c=100 → b, c, a
    expect(orderIds(rows, previousScoreOf)).toEqual(['b', 'c', 'a']);
  });

  it('breaks ties deterministically by nickname', () => {
    const tied = [
      row({ playerId: 'z', nickname: 'Zoe', score: 100 }),
      row({ playerId: 'a', nickname: 'Ada', score: 100 }),
    ];
    expect(orderIds(tied, (r) => r.score)).toEqual(['a', 'z']);
  });

  it('does not mutate the input array', () => {
    const input = [...rows];
    orderIds(input, (r) => r.score);
    expect(input).toEqual(rows);
  });
});

describe('lerpScore', () => {
  it('returns the start value at t=0', () => {
    expect(lerpScore(200, 800, 0)).toBe(200);
  });

  it('returns the end value at t=1', () => {
    expect(lerpScore(200, 800, 1)).toBe(800);
  });

  it('rounds intermediate values to whole points', () => {
    expect(lerpScore(0, 1000, 0.5)).toBe(500);
    expect(lerpScore(0, 999, 0.5)).toBe(500);
  });

  it('clamps progress outside the 0..1 range', () => {
    expect(lerpScore(200, 800, -1)).toBe(200);
    expect(lerpScore(200, 800, 2)).toBe(800);
  });
});

describe('easeOutCubic', () => {
  it('maps the endpoints to themselves', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('decelerates — is already past halfway at t=0.5', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe('standingsSignature', () => {
  it('changes when a score changes', () => {
    const before = standingsSignature([row({ playerId: 'a', score: 100 })]);
    const after = standingsSignature([row({ playerId: 'a', score: 200 })]);
    expect(before).not.toBe(after);
  });

  it('is stable for identical standings', () => {
    const rows = [row({ playerId: 'a', score: 100, lastPoints: 50 })];
    expect(standingsSignature(rows)).toBe(standingsSignature([...rows]));
  });
});
