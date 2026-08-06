import { describe, it, expect } from 'vitest';
import {
  formatCategory,
  normalizeTriviaApiResult,
  normalizeTriviaApiResults,
  type TriviaApiResult,
} from './triviaApi.js';

const identityShuffle = <T>(items: T[]): T[] => [...items];

function result(overrides: Partial<TriviaApiResult> = {}): TriviaApiResult {
  return {
    category: 'history',
    id: 'abc123',
    correctAnswer: 'Right',
    incorrectAnswers: ['Wrong 1', 'Wrong 2', 'Wrong 3'],
    question: { text: 'Which one is right?' },
    difficulty: 'medium',
    ...overrides,
  };
}

describe('normalizeTriviaApiResult', () => {
  it('combines correct and incorrect answers into options', () => {
    const q = normalizeTriviaApiResult(result(), identityShuffle);
    expect(q.options).toEqual(['Right', 'Wrong 1', 'Wrong 2', 'Wrong 3']);
    expect(q.options[q.correctIndex]).toBe('Right');
  });

  it('tracks the correct answer through shuffling', () => {
    const reverse = <T>(items: T[]): T[] => [...items].reverse();
    const q = normalizeTriviaApiResult(result(), reverse);
    expect(q.options[q.correctIndex]).toBe('Right');
    expect(q.correctIndex).toBe(3);
  });

  it('derives a stable id namespaced with "tta-"', () => {
    const a = normalizeTriviaApiResult(result(), identityShuffle);
    const b = normalizeTriviaApiResult(result(), identityShuffle);
    expect(a.id).toBe(b.id);
    expect(a.id.startsWith('tta-')).toBe(true);
  });

  it('title-cases the category', () => {
    const q = normalizeTriviaApiResult(
      result({ category: 'arts_and_literature' }),
      identityShuffle,
    );
    expect(q.category).toBe('Arts And Literature');
  });

  it('trims whitespace from text and answers', () => {
    const q = normalizeTriviaApiResult(
      result({
        question: { text: '  Padded question?  ' },
        correctAnswer: '  Right  ',
      }),
      identityShuffle,
    );
    expect(q.text).toBe('Padded question?');
    expect(q.options).toContain('Right');
  });

  it('throws on an unexpected difficulty', () => {
    expect(() =>
      normalizeTriviaApiResult(result({ difficulty: 'impossible' }), identityShuffle),
    ).toThrow(/difficulty/i);
  });

  it('throws when the question text is empty', () => {
    expect(() =>
      normalizeTriviaApiResult(result({ question: { text: '   ' } }), identityShuffle),
    ).toThrow(/empty/i);
  });

  it('throws when answers are missing', () => {
    expect(() =>
      normalizeTriviaApiResult(result({ incorrectAnswers: [] }), identityShuffle),
    ).toThrow(/answers/i);
  });
});

describe('normalizeTriviaApiResults', () => {
  it('drops results that fail normalization', () => {
    const questions = normalizeTriviaApiResults(
      [result(), result({ difficulty: 'nope' })],
      identityShuffle,
    );
    expect(questions).toHaveLength(1);
  });

  it('de-duplicates by id (same text appearing twice)', () => {
    const questions = normalizeTriviaApiResults(
      [result(), result({ id: 'different-source-id' })],
      identityShuffle,
    );
    expect(questions).toHaveLength(1);
  });
});

describe('formatCategory', () => {
  it('turns a slug into title case', () => {
    expect(formatCategory('food_and_drink')).toBe('Food And Drink');
    expect(formatCategory('geography')).toBe('Geography');
  });
});
