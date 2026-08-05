import { createHash } from 'node:crypto';
import type { Difficulty, Question } from '@quiz/shared';

/**
 * A single result from the Open Trivia DB API
 * (https://opentdb.com/api.php). Text fields are expected to be encoded with
 * `encode=url3986` so they can be decoded with `decodeURIComponent`.
 */
export interface OpenTdbResult {
  category: string;
  type: 'multiple' | 'boolean';
  difficulty: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** Deterministic default: no injection needed, but replaceable in tests. */
export type Shuffle = <T>(items: T[]) => T[];

const fisherYatesShuffle: Shuffle = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

/**
 * Decode a single `url3986`-encoded field from the API. Falls back to the raw
 * value if it is not valid percent-encoding.
 */
export function decodeApiText(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Stable id derived from the (decoded) question text. */
function questionId(decodedText: string): string {
  const hash = createHash('sha1').update(decodedText).digest('hex').slice(0, 10);
  return `otdb-${hash}`;
}

function isDifficulty(value: string): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty);
}

/**
 * Convert one Open Trivia DB result into our internal {@link Question} shape:
 * decode all text, combine correct + incorrect options, shuffle them while
 * tracking which one is correct. Works for both `multiple` (4 options) and
 * `boolean` (2 options) question types.
 *
 * @throws if the difficulty is not one of easy/medium/hard.
 */
export function normalizeResult(
  raw: OpenTdbResult,
  shuffle: Shuffle = fisherYatesShuffle,
): Question {
  const difficulty = decodeApiText(raw.difficulty);
  if (!isDifficulty(difficulty)) {
    throw new Error(`Unexpected difficulty "${difficulty}" from Open Trivia DB.`);
  }

  const text = decodeApiText(raw.question);
  const options = shuffle([
    { text: decodeApiText(raw.correct_answer), correct: true },
    ...raw.incorrect_answers.map((answer) => ({
      text: decodeApiText(answer),
      correct: false,
    })),
  ]);

  return {
    id: questionId(text),
    category: decodeApiText(raw.category),
    difficulty,
    text,
    options: options.map((option) => option.text),
    correctIndex: options.findIndex((option) => option.correct),
  };
}

/**
 * Normalize a batch of results, dropping any that fail normalization and
 * de-duplicating by id (the same question can appear across API calls).
 */
export function normalizeResults(
  results: OpenTdbResult[],
  shuffle: Shuffle = fisherYatesShuffle,
): Question[] {
  const byId = new Map<string, Question>();
  for (const result of results) {
    let question: Question;
    try {
      question = normalizeResult(result, shuffle);
    } catch {
      continue;
    }
    if (!byId.has(question.id)) {
      byId.set(question.id, question);
    }
  }
  return [...byId.values()];
}
