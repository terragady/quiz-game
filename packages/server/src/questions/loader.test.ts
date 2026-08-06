import { describe, it, expect } from 'vitest';
import type { Question } from '@quiz/shared';
import {
  CURATED_QUESTIONS_PATH,
  DEFAULT_QUESTIONS_PATH,
  filterQuestions,
  listCategories,
  loadQuestionPool,
  loadQuestions,
  mergeQuestions,
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

describe('mergeQuestions', () => {
  it('combines lists and keeps the first occurrence of each id', () => {
    const curated: Question[] = [{ ...sample[0], text: 'Curated version' }];
    const imported: Question[] = [
      { ...sample[0], text: 'Imported duplicate' },
      sample[2],
    ];
    const merged = mergeQuestions(curated, imported);
    expect(merged.map((q) => q.id)).toEqual(['a', 'c']);
    expect(merged.find((q) => q.id === 'a')?.text).toBe('Curated version');
  });
});

describe('loadQuestionPool', () => {
  it('loads and merges the curated and imported files', () => {
    const pool = loadQuestionPool();
    const ids = new Set(pool.map((q) => q.id));
    expect(ids.size).toBe(pool.length); // no duplicate ids
    expect(pool.some((q) => q.category === 'Norway')).toBe(true);
    expect(pool.some((q) => q.category === 'Poland')).toBe(true);
  });

  it('still returns curated questions when the imported file is absent', () => {
    const pool = loadQuestionPool(CURATED_QUESTIONS_PATH, '/no/such/file.json');
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.some((q) => q.category === 'Europe')).toBe(true);
  });

  it('throws when both files are missing', () => {
    expect(() =>
      loadQuestionPool('/no/curated.json', '/no/imported.json'),
    ).toThrow(/No questions available/);
  });
});
