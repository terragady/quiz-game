import { describe, it, expect } from 'vitest';
import type { OpenTdbResult } from './normalize.js';
import {
  decodeApiText,
  normalizeResult,
  normalizeResults,
} from './normalize.js';
import { validateQuestionsData } from './loader.js';

const identity = <T>(items: T[]): T[] => [...items];

function multipleResult(overrides: Partial<OpenTdbResult> = {}): OpenTdbResult {
  return {
    category: 'Science%3A%20Computers',
    type: 'multiple',
    difficulty: 'easy',
    question: 'What%20does%20CPU%20stand%20for%3F',
    correct_answer: 'Central%20Processing%20Unit',
    incorrect_answers: [
      'Central%20Process%20Unit',
      'Computer%20Personal%20Unit',
      'Central%20Processor%20Unit',
    ],
    ...overrides,
  };
}

describe('decodeApiText', () => {
  it('decodes url3986-encoded text', () => {
    expect(decodeApiText('Don%27t%20Panic%21')).toBe("Don't Panic!");
  });

  it('falls back to the raw value on invalid encoding', () => {
    expect(decodeApiText('100%')).toBe('100%');
  });
});

describe('normalizeResult', () => {
  it('decodes fields and places the correct answer at correctIndex', () => {
    const question = normalizeResult(multipleResult(), identity);

    expect(question.category).toBe('Science: Computers');
    expect(question.text).toBe('What does CPU stand for?');
    expect(question.difficulty).toBe('easy');
    expect(question.options).toHaveLength(4);
    expect(question.correctIndex).toBe(0);
    expect(question.options[question.correctIndex]).toBe(
      'Central Processing Unit',
    );
  });

  it('tracks the correct answer through shuffling', () => {
    const reverse = <T>(items: T[]): T[] => [...items].reverse();
    const question = normalizeResult(multipleResult(), reverse);

    expect(question.correctIndex).toBe(3);
    expect(question.options[question.correctIndex]).toBe(
      'Central Processing Unit',
    );
  });

  it('handles True/False questions as two options', () => {
    const question = normalizeResult(
      {
        category: 'General%20Knowledge',
        type: 'boolean',
        difficulty: 'medium',
        question: 'The%20sky%20is%20blue.',
        correct_answer: 'True',
        incorrect_answers: ['False'],
      },
      identity,
    );

    expect(question.options).toEqual(['True', 'False']);
    expect(question.correctIndex).toBe(0);
    expect(question.difficulty).toBe('medium');
  });

  it('gives stable ids derived from the question text', () => {
    const a = normalizeResult(multipleResult(), identity);
    const b = normalizeResult(multipleResult(), identity);
    expect(a.id).toBe(b.id);
    expect(a.id).toMatch(/^otdb-[0-9a-f]{10}$/);
  });

  it('throws on an unexpected difficulty', () => {
    expect(() =>
      normalizeResult(multipleResult({ difficulty: 'impossible' }), identity),
    ).toThrow(/difficulty/i);
  });
});

describe('normalizeResults', () => {
  it('produces questions that pass loader validation', () => {
    const questions = normalizeResults([
      multipleResult(),
      multipleResult({
        question: 'What%20is%202%20%2B%202%3F',
        correct_answer: '4',
        incorrect_answers: ['3', '5', '22'],
      }),
    ]);

    expect(questions).toHaveLength(2);
    expect(() => validateQuestionsData(questions)).not.toThrow();
  });

  it('de-duplicates questions with the same text', () => {
    const questions = normalizeResults([multipleResult(), multipleResult()]);
    expect(questions).toHaveLength(1);
  });

  it('skips results that fail normalization', () => {
    const questions = normalizeResults([
      multipleResult(),
      multipleResult({ difficulty: 'nonsense' }),
    ]);
    expect(questions).toHaveLength(1);
  });
});
