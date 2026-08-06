import { createHash } from 'node:crypto';
import type { Difficulty, Question } from '@quiz/shared';

export interface TriviaApiResult {
  category: string;
  id: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  question: { text: string };
  tags?: string[];
  type?: string;
  difficulty: string;
  regions?: string[];
  isNiche?: boolean;
}

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export type Shuffle = <T>(items: T[]) => T[];

const fisherYatesShuffle: Shuffle = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

function questionId(text: string): string {
  const hash = createHash('sha1').update(text).digest('hex').slice(0, 10);
  return `tta-${hash}`;
}

function isDifficulty(value: string): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty);
}

export function formatCategory(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function normalizeTriviaApiResult(
  raw: TriviaApiResult,
  shuffle: Shuffle = fisherYatesShuffle,
): Question {
  const difficulty = raw.difficulty?.trim();
  if (!isDifficulty(difficulty)) {
    throw new Error(`Unexpected difficulty "${raw.difficulty}" from The Trivia API.`);
  }

  const text = raw.question?.text?.trim();
  if (!text) {
    throw new Error('The Trivia API result has empty question text.');
  }

  const correct = raw.correctAnswer?.trim();
  const incorrect = (raw.incorrectAnswers ?? []).map((answer) => answer.trim());
  if (!correct || incorrect.length === 0) {
    throw new Error('The Trivia API result is missing answers.');
  }

  const options = shuffle([
    { text: correct, correct: true },
    ...incorrect.map((answer) => ({ text: answer, correct: false })),
  ]);

  return {
    id: questionId(text),
    category: formatCategory(raw.category),
    difficulty,
    text,
    options: options.map((option) => option.text),
    correctIndex: options.findIndex((option) => option.correct),
  };
}

export function normalizeTriviaApiResults(
  results: TriviaApiResult[],
  shuffle: Shuffle = fisherYatesShuffle,
): Question[] {
  const byId = new Map<string, Question>();
  for (const result of results) {
    let question: Question;
    try {
      question = normalizeTriviaApiResult(result, shuffle);
    } catch {
      continue;
    }
    if (!byId.has(question.id)) {
      byId.set(question.id, question);
    }
  }
  return [...byId.values()];
}
