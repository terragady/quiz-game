import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  CategorySummary,
  Difficulty,
  Question,
} from '@quiz/shared';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/**
 * Absolute path to the imported questions file. This is the Open Trivia DB dump
 * produced by `npm run questions:import`; the import script overwrites it.
 */
export const DEFAULT_QUESTIONS_PATH = fileURLToPath(
  new URL('../../data/questions.json', import.meta.url),
);

/**
 * Absolute path to the hand-curated questions file (Europe, Norway, Poland).
 * This file is maintained by hand and is never overwritten by the importer, so
 * curated questions survive a re-import.
 */
export const CURATED_QUESTIONS_PATH = fileURLToPath(
  new URL('../../data/curated-questions.json', import.meta.url),
);

/**
 * Validate arbitrary parsed JSON into a typed list of questions.
 * Throws with a specific, human-readable message on the first problem.
 */
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
    throw new Error(
      `${where} "difficulty" must be one of easy, medium, hard.`,
    );
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
    throw new Error(`${where} "imageUrl" must be a non-empty string when present.`);
  }

  return {
    id: q.id as string,
    category: q.category as string,
    difficulty: q.difficulty,
    text: q.text as string,
    options: q.options as string[],
    correctIndex: q.correctIndex,
    ...(q.imageUrl !== undefined ? { imageUrl: q.imageUrl as string } : {}),
  };
}

function requireNonEmptyString(value: unknown, label: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function isDifficulty(value: unknown): value is Difficulty {
  return (
    typeof value === 'string' &&
    DIFFICULTIES.includes(value as Difficulty)
  );
}

/** Load and validate questions from disk (defaults to the committed file). */
export function loadQuestions(
  filePath: string = DEFAULT_QUESTIONS_PATH,
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

/**
 * Return a copy of the question with its options randomly reordered and the
 * correctIndex adjusted to follow the correct answer. This keeps the correct
 * option from always sitting in the same slot for hand-authored questions.
 */
export function withShuffledOptions(question: Question): Question {
  const correctText = question.options[question.correctIndex];
  const options = shuffle(question.options);
  return { ...question, options, correctIndex: options.indexOf(correctText) };
}

/** Combine question lists, keeping the first occurrence of each id. */
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

/**
 * Load the full question pool the game runs on: the hand-curated questions plus
 * the imported Open Trivia DB questions, de-duplicated by id. Either file may be
 * absent, but at least one must exist and yield questions.
 */
export function loadQuestionPool(
  curatedPath: string = CURATED_QUESTIONS_PATH,
  importedPath: string = DEFAULT_QUESTIONS_PATH,
): Question[] {
  const curated = existsSync(curatedPath) ? loadQuestions(curatedPath) : [];
  const imported = existsSync(importedPath) ? loadQuestions(importedPath) : [];
  const pool = mergeQuestions(curated, imported).map(withShuffledOptions);
  if (pool.length === 0) {
    throw new Error('No questions available: both question files are empty or missing.');
  }
  return pool;
}

export interface SelectionCriteria {
  count: number;
  category?: string | null;
  difficulty?: Difficulty | null;
}

/** Deterministically filter questions by category and difficulty. */
export function filterQuestions(
  questions: Question[],
  criteria: Pick<SelectionCriteria, 'category' | 'difficulty'>,
): Question[] {
  return questions.filter((q) => {
    if (criteria.category && q.category !== criteria.category) {
      return false;
    }
    if (criteria.difficulty && q.difficulty !== criteria.difficulty) {
      return false;
    }
    return true;
  });
}

/**
 * Filter, shuffle, and take up to `count` questions. Returns fewer than `count`
 * only when the filtered pool is smaller.
 */
export function selectQuestions(
  questions: Question[],
  criteria: SelectionCriteria,
): Question[] {
  const pool = filterQuestions(questions, criteria);
  return shuffle(pool).slice(0, Math.max(0, criteria.count));
}

/** Summarize available categories and their question counts. */
export function listCategories(questions: Question[]): CategorySummary[] {
  const counts = new Map<string, number>();
  for (const q of questions) {
    counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Fisher-Yates shuffle returning a new array. */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
