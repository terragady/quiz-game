import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  parseMelody,
  type CategorySummary,
  type Difficulty,
  type Question,
} from '@quiz/shared';

import { withTidyCategories } from './categories.js';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const POOL_QUESTIONS_PATH = fileURLToPath(
  new URL('../../data/questions.json', import.meta.url),
);

export const OPENTDB_QUESTIONS_PATH = fileURLToPath(
  new URL('../../data/opentdb-questions.json', import.meta.url),
);

export const CURATED_QUESTIONS_PATH = fileURLToPath(
  new URL('../../data/curated-questions.json', import.meta.url),
);

export const TRIVIA_API_QUESTIONS_PATH = fileURLToPath(
  new URL('../../data/trivia-api-questions.json', import.meta.url),
);

export function validateQuestionsData(data: unknown): Question[] {
  if (!Array.isArray(data)) {
    throw new Error('Questions data must be an array.');
  }
  return data.map((item, index) => validateQuestion(item, index));
}

function validateQuestion(item: unknown, index: number): Question {
  const where = `Question at index ${index}`;
  if (typeof item !== 'object' || item === null) {
    throw new Error(`${where} must be an object.`);
  }
  const q = item as Record<string, unknown>;

  requireNonEmptyString(q.id, `${where} "id"`);
  requireNonEmptyString(q.category, `${where} "category"`);
  requireNonEmptyString(q.text, `${where} "text"`);

  if (!isDifficulty(q.difficulty)) {
    throw new Error(`${where} "difficulty" must be one of easy, medium, hard.`);
  }

  if (!Array.isArray(q.options) || q.options.length < 2) {
    throw new Error(`${where} "options" must have at least 2 entries.`);
  }
  q.options.forEach((option, optionIndex) => {
    requireNonEmptyString(option, `${where} option ${optionIndex}`);
  });

  if (
    typeof q.correctIndex !== 'number' ||
    !Number.isInteger(q.correctIndex) ||
    q.correctIndex < 0 ||
    q.correctIndex >= q.options.length
  ) {
    throw new Error(
      `${where} "correctIndex" must be an integer within the options range.`,
    );
  }

  if (
    q.imageUrl !== undefined &&
    (typeof q.imageUrl !== 'string' || q.imageUrl.trim().length === 0)
  ) {
    throw new Error(
      `${where} "imageUrl" must be a non-empty string when present.`,
    );
  }

  if (q.melody !== undefined) {
    const melody = q.melody as Record<string, unknown> | null;
    if (
      typeof melody !== 'object' ||
      melody === null ||
      typeof melody.bpm !== 'number' ||
      melody.bpm <= 0 ||
      typeof melody.notes !== 'string'
    ) {
      throw new Error(
        `${where} "melody" must have a positive "bpm" and "notes".`,
      );
    }
    try {
      parseMelody(melody.notes);
    } catch (error) {
      throw new Error(`${where} "melody": ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  return {
    id: q.id as string,
    category: q.category as string,
    difficulty: q.difficulty,
    text: q.text as string,
    options: q.options as string[],
    correctIndex: q.correctIndex,
    ...(q.imageUrl !== undefined ? { imageUrl: q.imageUrl as string } : {}),
    ...(q.melody !== undefined
      ? { melody: q.melody as Question['melody'] }
      : {}),
  };
}

function requireNonEmptyString(value: unknown, label: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function isDifficulty(value: unknown): value is Difficulty {
  return (
    typeof value === 'string' && DIFFICULTIES.includes(value as Difficulty)
  );
}

export function loadQuestions(
  filePath: string = POOL_QUESTIONS_PATH,
): Question[] {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch {
    throw new Error(`Could not read questions file at ${filePath}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Questions file at ${filePath} is not valid JSON.`);
  }

  return validateQuestionsData(parsed);
}

export function withShuffledOptions(question: Question): Question {
  const order = shuffle(question.options.map((_, index) => index));
  const options = order.map((index) => question.options[index]);
  return {
    ...question,
    options,
    correctIndex: order.indexOf(question.correctIndex),
  };
}

export function mergeQuestions(...lists: Question[][]): Question[] {
  const byId = new Map<string, Question>();
  for (const list of lists) {
    for (const question of list) {
      if (!byId.has(question.id)) {
        byId.set(question.id, question);
      }
    }
  }
  return [...byId.values()];
}

export function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/&[a-z0-9#]+;/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function dedupeByText(questions: Question[]): Question[] {
  const seen = new Set<string>();
  const result: Question[] = [];
  for (const question of questions) {
    const key = `${normalizeQuestionText(question.text)}\u0000${question.imageUrl ?? ''}\u0000${question.melody?.notes ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(question);
  }
  return result;
}

// Words that don't change what a question asks, so "What is the capital of
// Finland?" and "What is the capital city of Finland?" read as the same.
const FILLER_WORDS = new Set([
  'a',
  'an',
  'the',
  'of',
  'is',
  'was',
  'which',
  'what',
  'who',
  'in',
  'on',
  'to',
  'for',
  'by',
  'do',
  'does',
  'did',
  'are',
  'has',
  'have',
  'these',
  'following',
  'city',
  'total',
  'just',
  'name',
]);

function contentWords(text: string): Set<string> {
  return new Set(
    normalizeQuestionText(text)
      .split(' ')
      .filter((word) => word && !FILLER_WORDS.has(word)),
  );
}

function asksTheSame(a: Set<string>, b: Set<string>): boolean {
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  // A short question only counts when the wording matches exactly; a longer
  // one also counts when the other question just adds detail to it.
  if (small.size < 3 && small.size !== big.size) return false;
  for (const word of small) {
    if (!big.has(word)) return false;
  }
  return true;
}

// Different sources often ask the same thing in different words. Drop a
// question when an earlier one has the same correct answer and asks the
// same thing. Picture, tune and true/false questions are left alone: their
// text alone doesn't say what is being asked.
export function dropRewordedDuplicates(questions: Question[]): Question[] {
  const seenByAnswer = new Map<string, Set<string>[]>();
  return questions.filter((question) => {
    if (question.imageUrl || question.melody || question.options.length < 3) {
      return true;
    }
    const answer = normalizeQuestionText(
      question.options[question.correctIndex],
    );
    const words = contentWords(question.text);
    const seen = seenByAnswer.get(answer) ?? [];
    if (seen.some((earlier) => asksTheSame(earlier, words))) return false;
    seen.push(words);
    seenByAnswer.set(answer, seen);
    return true;
  });
}

export function buildQuestionPool(
  curatedPath: string = CURATED_QUESTIONS_PATH,
  openTdbPath: string = OPENTDB_QUESTIONS_PATH,
  triviaApiPath: string = TRIVIA_API_QUESTIONS_PATH,
): Question[] {
  const curated = existsSync(curatedPath) ? loadQuestions(curatedPath) : [];
  const openTdb = existsSync(openTdbPath) ? loadQuestions(openTdbPath) : [];
  const triviaApi = existsSync(triviaApiPath)
    ? loadQuestions(triviaApiPath)
    : [];
  return withTidyCategories(
    dropRewordedDuplicates(
      dedupeByText(mergeQuestions(curated, openTdb, triviaApi)),
    ),
  );
}

export function loadQuestionPool(
  poolPath: string = POOL_QUESTIONS_PATH,
): Question[] {
  const pool = existsSync(poolPath) ? loadQuestions(poolPath) : [];
  if (pool.length === 0) {
    throw new Error(
      'No questions available: the pool file is empty or missing. ' +
        'Run "npm run questions:build" to generate it from the source files.',
    );
  }
  return pool;
}

export interface SelectionCriteria {
  count: number;
  categories?: string[] | null;
  difficulty?: Difficulty | null;
}

export function filterQuestions(
  questions: Question[],
  criteria: Pick<SelectionCriteria, 'categories' | 'difficulty'>,
): Question[] {
  const categorySet =
    criteria.categories && criteria.categories.length > 0
      ? new Set(criteria.categories)
      : null;
  return questions.filter((q) => {
    if (categorySet && !categorySet.has(q.category)) {
      return false;
    }
    if (criteria.difficulty && q.difficulty !== criteria.difficulty) {
      return false;
    }
    return true;
  });
}

export function selectQuestions(
  questions: Question[],
  criteria: SelectionCriteria,
): Question[] {
  const pool = filterQuestions(questions, criteria);
  return shuffle(pool)
    .slice(0, Math.max(0, criteria.count))
    .map(withShuffledOptions);
}

export function listCategories(questions: Question[]): CategorySummary[] {
  const counts = new Map<string, number>();
  for (const q of questions) {
    counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
