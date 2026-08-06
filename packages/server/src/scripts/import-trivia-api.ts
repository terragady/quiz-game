import { existsSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Question } from '@quiz/shared';
import {
  CURATED_QUESTIONS_PATH,
  OPENTDB_QUESTIONS_PATH,
  TRIVIA_API_QUESTIONS_PATH,
  loadQuestions,
  normalizeQuestionText,
  validateQuestionsData,
} from '../questions/loader.js';
import { writeQuestionPool } from '../questions/buildPool.js';
import {
  normalizeTriviaApiResults,
  type TriviaApiResult,
} from '../questions/triviaApi.js';

const API_URL = 'https://the-trivia-api.com/v2/questions';
const MAX_PER_REQUEST = 50;
const REQUEST_SPACING_MS = 2500;
const RATE_LIMIT_BACKOFF_MS = 6000;
const MAX_RATE_LIMIT_RETRIES = 5;
const MAX_EMPTY_STREAK = 5;

function parseArgs(argv: string[]): { count: number } {
  let count = 300;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--count') {
      const value = Number(argv[i + 1]);
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`--count must be a non-negative integer (got "${argv[i + 1]}").`);
      }
      count = value;
      i += 1;
    }
  }
  return { count };
}

class RateLimitedError extends Error {}

async function fetchBatch(amount: number): Promise<TriviaApiResult[]> {
  const params = new URLSearchParams({ limit: String(amount) });
  const response = await fetch(`${API_URL}?${params.toString()}`);
  if (response.status === 429) {
    throw new RateLimitedError('Rate limited by The Trivia API.');
  }
  if (!response.ok) {
    throw new Error(`The Trivia API returned HTTP ${response.status}.`);
  }
  return (await response.json()) as TriviaApiResult[];
}

function loadIfPresent(path: string): Question[] {
  return existsSync(path) ? loadQuestions(path) : [];
}

async function main(): Promise<void> {
  const { count } = parseArgs(process.argv.slice(2));
  console.log(`Fetching up to ${count} new questions from The Trivia API…`);

  const existingOther = [
    ...loadIfPresent(CURATED_QUESTIONS_PATH),
    ...loadIfPresent(OPENTDB_QUESTIONS_PATH),
  ];
  const existingTrivia = loadIfPresent(TRIVIA_API_QUESTIONS_PATH);

  const seenText = new Set<string>(
    [...existingOther, ...existingTrivia].map((q) => normalizeQuestionText(q.text)),
  );
  const seenId = new Set<string>(existingTrivia.map((q) => q.id));
  const collected: Question[] = [...existingTrivia];

  let added = 0;
  let emptyStreak = 0;
  let rateLimitRetries = 0;
  let first = true;

  while (added < count && emptyStreak < MAX_EMPTY_STREAK) {
    if (!first) await sleep(REQUEST_SPACING_MS);
    first = false;

    console.log(`  Requesting ${MAX_PER_REQUEST} questions…`);
    let batch: TriviaApiResult[];
    try {
      batch = await fetchBatch(MAX_PER_REQUEST);
    } catch (error) {
      if (error instanceof RateLimitedError) {
        if (rateLimitRetries >= MAX_RATE_LIMIT_RETRIES) {
          console.warn('  Still rate limited after retries, stopping.');
          break;
        }
        rateLimitRetries += 1;
        console.warn('  Rate limited, backing off…');
        await sleep(RATE_LIMIT_BACKOFF_MS);
        continue;
      }
      throw error;
    }
    rateLimitRetries = 0;

    const normalized = normalizeTriviaApiResults(batch);
    let newThisBatch = 0;
    for (const question of normalized) {
      const textKey = normalizeQuestionText(question.text);
      if (seenId.has(question.id) || seenText.has(textKey)) continue;
      seenId.add(question.id);
      seenText.add(textKey);
      collected.push(question);
      newThisBatch += 1;
      added += 1;
      if (added >= count) break;
    }
    emptyStreak = newThisBatch === 0 ? emptyStreak + 1 : 0;
    console.log(`    +${newThisBatch} new (${added}/${count})`);
  }

  validateQuestionsData(collected);
  writeFileSync(
    TRIVIA_API_QUESTIONS_PATH,
    `${JSON.stringify(collected, null, 2)}\n`,
    'utf-8',
  );
  console.log(
    `Added ${added} new; wrote ${collected.length} total to ${TRIVIA_API_QUESTIONS_PATH}`,
  );

  const pool = writeQuestionPool();
  console.log(`Rebuilt pool: ${pool.length} questions.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
