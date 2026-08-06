/**
 * Fetch trivia questions from the Open Trivia DB (https://opentdb.com), normalize
 * them into our internal format, and write them to the committed questions file.
 *
 * The running app never talks to Open Trivia DB — it only reads the committed
 * JSON. Re-run this script to refresh the question pool:
 *
 *   npm run questions:import
 *   npm run questions:import -- --multiple 250 --boolean 80
 *
 * Open Trivia DB caps each request at 50 questions, rate-limits repeated calls,
 * and (called anonymously) serves a random set each time that can repeat across
 * calls. We therefore keep pulling batches and de-duplicate by a stable id,
 * stopping once we hit the requested count or several batches in a row add no
 * new questions (a sign the reachable pool is exhausted).
 */
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { OPENTDB_QUESTIONS_PATH, validateQuestionsData } from '../questions/loader.js';
import { writeQuestionPool } from '../questions/buildPool.js';
import { normalizeResults, type OpenTdbResult } from '../questions/normalize.js';

const API_URL = 'https://opentdb.com/api.php';
const MAX_PER_REQUEST = 50;
/** Open Trivia DB rate-limits to roughly one request per 5s per IP. */
const REQUEST_SPACING_MS = 5500;
/** Back off longer after an explicit rate-limit response before retrying. */
const RATE_LIMIT_BACKOFF_MS = 8000;
const MAX_RATE_LIMIT_RETRIES = 5;
/** Give up on a type after this many consecutive batches add nothing new. */
const MAX_EMPTY_STREAK = 4;

type QuestionType = 'multiple' | 'boolean';

interface ApiResponse {
  response_code: number;
  results: OpenTdbResult[];
}

function parseCount(raw: string | undefined, flag: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${flag} must be a non-negative integer (got "${raw}").`);
  }
  return value;
}

function parseArgs(argv: string[]): { multiple: number; boolean: number } {
  let multiple = 250;
  let booleanCount = 80;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--multiple') {
      multiple = parseCount(argv[i + 1], '--multiple');
      i += 1;
    } else if (argv[i] === '--boolean') {
      booleanCount = parseCount(argv[i + 1], '--boolean');
      i += 1;
    }
  }
  return { multiple, boolean: booleanCount };
}

async function fetchBatch(type: QuestionType, amount: number): Promise<ApiResponse> {
  const params = new URLSearchParams({
    amount: String(amount),
    type,
    encode: 'url3986',
  });
  const response = await fetch(`${API_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Open Trivia DB returned HTTP ${response.status}.`);
  }
  return (await response.json()) as ApiResponse;
}

/**
 * Pull questions of one type into `collected`, de-duplicating by the raw
 * question text across the whole run, until we reach `target` unique of this
 * type or the reachable pool appears exhausted.
 */
async function fetchType(
  type: QuestionType,
  target: number,
  seen: Set<string>,
  collected: OpenTdbResult[],
  spacing: { first: boolean },
): Promise<void> {
  let added = 0;
  let emptyStreak = 0;
  let rateLimitRetries = 0;

  while (added < target && emptyStreak < MAX_EMPTY_STREAK) {
    if (!spacing.first) await sleep(REQUEST_SPACING_MS);
    spacing.first = false;

    console.log(`  Requesting ${MAX_PER_REQUEST} ${type} questions…`);
    const data = await fetchBatch(type, MAX_PER_REQUEST);

    if (data.response_code === 5) {
      if (rateLimitRetries >= MAX_RATE_LIMIT_RETRIES) {
        console.warn(`  ${type}: still rate-limited after retries, stopping.`);
        break;
      }
      rateLimitRetries += 1;
      console.warn(`  ${type}: rate limited, backing off…`);
      await sleep(RATE_LIMIT_BACKOFF_MS);
      continue;
    }
    if (data.response_code !== 0) {
      console.warn(`  ${type}: response_code ${data.response_code}, stopping.`);
      break;
    }

    rateLimitRetries = 0;
    let newThisBatch = 0;
    for (const result of data.results) {
      if (!seen.has(result.question)) {
        seen.add(result.question);
        collected.push(result);
        newThisBatch += 1;
        added += 1;
        if (added >= target) break;
      }
    }
    emptyStreak = newThisBatch === 0 ? emptyStreak + 1 : 0;
    console.log(`    +${newThisBatch} new (${added}/${target} ${type})`);
  }
}

async function main(): Promise<void> {
  const { multiple, boolean: booleanCount } = parseArgs(process.argv.slice(2));
  console.log(
    `Fetching up to ${multiple} multiple-choice and ${booleanCount} true/false ` +
      `questions from Open Trivia DB…`,
  );

  const seen = new Set<string>();
  const raw: OpenTdbResult[] = [];
  const spacing = { first: true };

  await fetchType('multiple', multiple, seen, raw, spacing);
  await fetchType('boolean', booleanCount, seen, raw, spacing);

  const questions = normalizeResults(raw);
  if (questions.length === 0) {
    throw new Error('No questions fetched — aborting without writing the file.');
  }
  validateQuestionsData(questions);

  writeFileSync(
    OPENTDB_QUESTIONS_PATH,
    `${JSON.stringify(questions, null, 2)}\n`,
    'utf-8',
  );
  console.log(
    `Wrote ${questions.length} unique questions to ${OPENTDB_QUESTIONS_PATH}`,
  );

  const pool = writeQuestionPool();
  console.log(`Rebuilt pool: ${pool.length} questions.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
