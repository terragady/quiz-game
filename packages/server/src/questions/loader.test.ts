import { describe, it, expect } from 'vitest';
import type { Question } from '@quiz/shared';
import {
  CURATED_QUESTIONS_PATH,
  POOL_QUESTIONS_PATH,
  buildQuestionPool,
  dedupeByText,
  filterQuestions,
  listCategories,
  loadQuestionPool,
  loadQuestions,
  mergeQuestions,
  normalizeQuestionText,
  selectQuestions,
  validateQuestionsData,
  withShuffledOptions,
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

  it('accepts an optional imageUrl and preserves it', () => {
    const withImage = [{ ...sample[0], imageUrl: 'https://example.com/x.png' }];
    expect(validateQuestionsData(withImage)[0].imageUrl).toBe(
      'https://example.com/x.png',
    );
  });

  it('rejects a blank imageUrl when present', () => {
    const bad = [{ ...sample[0], imageUrl: '   ' }];
    expect(() => validateQuestionsData(bad)).toThrow(/imageUrl/);
  });
});

describe('withShuffledOptions', () => {
  it('keeps correctIndex pointing at the correct answer text', () => {
    const source: Question = {
      id: 'z',
      category: 'Test',
      difficulty: 'easy',
      text: 'Pick the right one',
      options: ['Right', 'Wrong1', 'Wrong2', 'Wrong3'],
      correctIndex: 0,
    };
    for (let i = 0; i < 50; i += 1) {
      const shuffled = withShuffledOptions(source);
      expect(shuffled.options).toHaveLength(4);
      expect(shuffled.options[shuffled.correctIndex]).toBe('Right');
      expect([...shuffled.options].sort()).toEqual(
        [...source.options].sort(),
      );
    }
  });

  it('maps correctIndex by position when option texts repeat', () => {
    const source: Question = {
      id: 'dup',
      category: 'Test',
      difficulty: 'easy',
      text: 'How many?',
      options: ['0', '0', '1', '0'],
      correctIndex: 2,
    };
    for (let i = 0; i < 50; i += 1) {
      const shuffled = withShuffledOptions(source);
      expect(shuffled.options[shuffled.correctIndex]).toBe('1');
      expect(shuffled.options.filter((o) => o === '0')).toHaveLength(3);
    }
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

  it('shuffles each question\'s options while keeping correctIndex accurate', () => {
    const source: Question[] = [
      {
        id: 'shuffle-me',
        category: 'Test',
        difficulty: 'easy',
        text: 'Pick the right one',
        options: ['Right', 'Wrong1', 'Wrong2', 'Wrong3'],
        correctIndex: 0,
      },
    ];
    for (let i = 0; i < 50; i += 1) {
      const [picked] = selectQuestions(source, { count: 1 });
      expect(picked.options[picked.correctIndex]).toBe('Right');
      expect([...picked.options].sort()).toEqual([...source[0].options].sort());
    }
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

describe('loadQuestions (pool file)', () => {
  it('loads and validates the committed pool questions', () => {
    const questions = loadQuestions(POOL_QUESTIONS_PATH);
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

describe('normalizeQuestionText', () => {
  it('ignores casing, punctuation, and whitespace differences', () => {
    expect(normalizeQuestionText('Capital of France?')).toBe(
      normalizeQuestionText('  capital   of france '),
    );
  });

  it('strips HTML entities', () => {
    expect(normalizeQuestionText('Tom &amp; Jerry')).toBe(
      normalizeQuestionText('Tom Jerry'),
    );
  });
});

describe('dedupeByText', () => {
  it('removes later questions whose text duplicates an earlier one', () => {
    const first: Question = { ...sample[2], id: 'first' };
    const dup: Question = { ...sample[2], id: 'second', text: 'capital of FRANCE?' };
    const result = dedupeByText([first, dup, sample[0]]);
    expect(result.map((q) => q.id)).toEqual(['first', 'a']);
  });

  it('keeps image questions that share a prompt but differ by image', () => {
    const flagOne: Question = {
      id: 'flag-1',
      category: 'Flags',
      difficulty: 'easy',
      text: "Which country's flag is this?",
      options: ['Norway', 'Sweden'],
      correctIndex: 0,
      imageUrl: 'https://flagcdn.com/w320/no.png',
    };
    const flagTwo: Question = {
      ...flagOne,
      id: 'flag-2',
      options: ['Sweden', 'Norway'],
      imageUrl: 'https://flagcdn.com/w320/se.png',
    };
    expect(dedupeByText([flagOne, flagTwo]).map((q) => q.id)).toEqual([
      'flag-1',
      'flag-2',
    ]);
  });
});

describe('buildQuestionPool', () => {
  it('merges the source files with no duplicate ids', () => {
    const pool = buildQuestionPool();
    const ids = new Set(pool.map((q) => q.id));
    expect(ids.size).toBe(pool.length);
    expect(pool.some((q) => q.category === 'Norway')).toBe(true);
    expect(pool.some((q) => q.category === 'Poland')).toBe(true);
  });

  it('contains no duplicate question text (image questions aside)', () => {
    const pool = buildQuestionPool();
    const keys = pool
      .filter((q) => !q.imageUrl)
      .map((q) => normalizeQuestionText(q.text));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('still returns curated questions when the other sources are absent', () => {
    const pool = buildQuestionPool(
      CURATED_QUESTIONS_PATH,
      '/no/such/file.json',
      '/no/such/trivia.json',
    );
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.some((q) => q.category === 'Europe')).toBe(true);
  });
});

describe('loadQuestionPool', () => {
  it('loads the pre-built committed pool', () => {
    const pool = loadQuestionPool();
    const ids = new Set(pool.map((q) => q.id));
    expect(ids.size).toBe(pool.length);
    expect(pool.some((q) => q.category === 'Norway')).toBe(true);
    expect(pool.some((q) => q.category === 'Poland')).toBe(true);
  });

  it('throws when the pool file is missing', () => {
    expect(() => loadQuestionPool('/no/such/pool.json')).toThrow(
      /No questions available/,
    );
  });
});
