import { describe, it, expect } from 'vitest';
import type { Question } from '@quiz/shared';
import {
  DEFAULT_QUESTIONS_PATH,
  filterQuestions,
  listCategories,
  loadQuestions,
  selectQuestions,
  validateQuestionsData,
} from './loader.js';

const sample: Question[] = [
  {
    id: 'a',
    category: 'Science',
    difficulty: 'easy',
    text: 'Water is made of hydrogen and what?',
    options: ['Oxygen', 'Nitrogen', 'Carbon', 'Helium'],
    correctIndex: 0,
  },
  {
    id: 'b',
    category: 'Science',
    difficulty: 'hard',
    text: 'The speed of light is constant.',
    options: ['True', 'False'],
    correctIndex: 0,
  },
  {
    id: 'c',
    category: 'Geography',
    difficulty: 'easy',
    text: 'Capital of France?',
    options: ['Paris', 'Rome', 'Berlin', 'Madrid'],
    correctIndex: 0,
  },
];

describe('validateQuestionsData', () => {
  it('accepts valid data', () => {
    expect(validateQuestionsData(sample)).toHaveLength(3);
  });

  it('rejects non-array data', () => {
    expect(() => validateQuestionsData({})).toThrow(/must be an array/);
  });

  it('rejects a bad difficulty', () => {
    const bad = [{ ...sample[0], difficulty: 'tricky' }];
    expect(() => validateQuestionsData(bad)).toThrow(/difficulty/);
  });

  it('rejects fewer than two options', () => {
    const bad = [{ ...sample[0], options: ['Only one'], correctIndex: 0 }];
    expect(() => validateQuestionsData(bad)).toThrow(/at least 2/);
  });

  it('rejects an out-of-range correctIndex', () => {
    const bad = [{ ...sample[0], correctIndex: 9 }];
    expect(() => validateQuestionsData(bad)).toThrow(/correctIndex/);
  });

  it('rejects an empty text field', () => {
    const bad = [{ ...sample[0], text: '   ' }];
    expect(() => validateQuestionsData(bad)).toThrow(/text/);
  });
});

describe('filterQuestions', () => {
  it('filters by category', () => {
    const result = filterQuestions(sample, { category: 'Science' });
    expect(result.map((q) => q.id)).toEqual(['a', 'b']);
  });

  it('filters by difficulty', () => {
    const result = filterQuestions(sample, { difficulty: 'easy' });
    expect(result.map((q) => q.id)).toEqual(['a', 'c']);
  });

  it('filters by category and difficulty together', () => {
    const result = filterQuestions(sample, {
      category: 'Science',
      difficulty: 'easy',
    });
    expect(result.map((q) => q.id)).toEqual(['a']);
  });

  it('returns all when no filters are given', () => {
    expect(filterQuestions(sample, {})).toHaveLength(3);
  });
});

describe('selectQuestions', () => {
  it('returns at most the requested count', () => {
    expect(selectQuestions(sample, { count: 2 })).toHaveLength(2);
  });

  it('returns the whole pool when count exceeds it', () => {
    expect(selectQuestions(sample, { count: 99 })).toHaveLength(3);
  });

  it('only returns questions matching the filter', () => {
    const result = selectQuestions(sample, {
      count: 10,
      category: 'Science',
    });
    expect(result.every((q) => q.category === 'Science')).toBe(true);
  });
});

describe('listCategories', () => {
  it('counts questions per category, sorted by name', () => {
    expect(listCategories(sample)).toEqual([
      { name: 'Geography', count: 1 },
      { name: 'Science', count: 2 },
    ]);
  });
});

describe('loadQuestions (seed file)', () => {
  it('loads and validates the committed seed questions', () => {
    const questions = loadQuestions(DEFAULT_QUESTIONS_PATH);
    expect(questions.length).toBeGreaterThanOrEqual(10);
  });

  it('throws a clear error for a missing file', () => {
    expect(() => loadQuestions('/no/such/file.json')).toThrow(/Could not read/);
  });
});
