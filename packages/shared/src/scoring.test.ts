import { describe, it, expect } from 'vitest';
import { calculateScore } from './scoring.js';
import { BASE_POINTS } from './constants.js';

describe('calculateScore', () => {
  const duration = 20_000;

  it('awards zero for a wrong answer regardless of speed', () => {
    expect(
      calculateScore({
        correct: false,
        timeRemainingMs: duration,
        questionDurationMs: duration,
      }),
    ).toBe(0);
  });

  it('awards full base points for an instant correct answer', () => {
    expect(
      calculateScore({
        correct: true,
        timeRemainingMs: duration,
        questionDurationMs: duration,
      }),
    ).toBe(BASE_POINTS);
  });

  it('awards half base points for a correct answer at the deadline', () => {
    expect(
      calculateScore({
        correct: true,
        timeRemainingMs: 0,
        questionDurationMs: duration,
      }),
    ).toBe(BASE_POINTS / 2);
  });

  it('decreases points monotonically as time remaining shrinks', () => {
    const fast = calculateScore({
      correct: true,
      timeRemainingMs: 15_000,
      questionDurationMs: duration,
    });
    const slow = calculateScore({
      correct: true,
      timeRemainingMs: 5_000,
      questionDurationMs: duration,
    });
    expect(fast).toBeGreaterThan(slow);
    expect(slow).toBeGreaterThanOrEqual(BASE_POINTS / 2);
  });

  it('clamps time remaining that exceeds the duration', () => {
    expect(
      calculateScore({
        correct: true,
        timeRemainingMs: duration + 5_000,
        questionDurationMs: duration,
      }),
    ).toBe(BASE_POINTS);
  });

  it('never returns a negative score for negative time remaining', () => {
    const points = calculateScore({
      correct: true,
      timeRemainingMs: -1_000,
      questionDurationMs: duration,
    });
    expect(points).toBe(BASE_POINTS / 2);
    expect(points).toBeGreaterThanOrEqual(0);
  });

  it('handles a zero duration without dividing by zero', () => {
    const points = calculateScore({
      correct: true,
      timeRemainingMs: 0,
      questionDurationMs: 0,
    });
    expect(points).toBe(BASE_POINTS / 2);
  });

  it('honors a custom base points value', () => {
    expect(
      calculateScore({
        correct: true,
        timeRemainingMs: duration,
        questionDurationMs: duration,
        basePoints: 500,
      }),
    ).toBe(500);
  });

  it('returns an integer', () => {
    const points = calculateScore({
      correct: true,
      timeRemainingMs: 7_333,
      questionDurationMs: duration,
    });
    expect(Number.isInteger(points)).toBe(true);
  });
});
