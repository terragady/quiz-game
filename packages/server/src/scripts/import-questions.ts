/**
 * Fetch trivia questions from the Open Trivia DB (https://opentdb.com), normalize
 * them into our internal format, and write them to the committed questions file.
 *
 * The running app never talks to Open Trivia DB — it only reads the committed
 * JSON. Re-run this script to refresh the question pool:
 *
 *   npm run questions:import
 *   npm run questions:import -- --multiple 50 --boolean 20
 *
 * Open Trivia DB caps each request at 50 questions and rate-limits repeated
 * calls, so we space requests out. Duplicate questions across batches are
 * removed during normalization (by stable id).
 */
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { DEFAULT_QUESTIONS_PATH, validateQuestionsData } from '../questions/loader.js';
import { normalizeResults, type OpenTdbResult } from '../questions/normalize.js';

const API_URL = 'https://opentdb.com/api.php';
const MAX_PER_REQUEST = 50;
/** Open Trivia DB rate-limits to roughly one request per 5s per IP. */
const REQUEST_SPACING_MS = 5500;

interface ApiResponse {
  response_code: number;
  results: OpenTdbResult[];
}

interface Batch {
  amount: number;
  type: 'multiple' | 'boolean';
}

function parseCount(raw: string | undefined, flag: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${flag} must be a non-negative integer (got "${raw}").`);
  }
  return value;
}

function parseArgs(argv: string[]): { multiple: number; boolean: number } {
  let multiple = 50;
  let booleanCount = 15;
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

/** Split a desired amount into requests of at most MAX_PER_REQUEST. */
function planBatches(multiple: number, booleanCount: number): Batch[] {
  const batches: Batch[] = [];
  for (const [type, total] of [
    ['multiple', multiple],
    ['boolean', booleanCount],
  ] as const) {
    let remaining = total;
    while (remaining > 0) {
      batches.push({ type, amount: Math.min(MAX_PER_REQUEST, remaining) });
      remaining -= MAX_PER_REQUEST;
    }
  }
  return batches;
}

async function fetchBatch(batch: Batch): Promise<OpenTdbResult[]> {
  const params = new URLSearchParams({
    amount: String(batch.amount),
    type: batch.type,
    encode: 'url3986',
  });

  const response = await fetch(`${API_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Open Trivia DB returned HTTP ${response.status}.`);
  }
  const data = (await response.json()) as ApiResponse;
  if (data.response_code !== 0) {
    console.warn(
      `  Skipping ${batch.type} batch: response_code ${data.response_code}.`,
    );
    return [];
  }
  return data.results;
}

async function main(): Promise<void> {
  const { multiple, boolean: booleanCount } = parseArgs(process.argv.slice(2));
  const batches = planBatches(multiple, booleanCount);
  console.log(
    `Fetching ~${multiple} multiple-choice and ~${booleanCount} true/false ` +
      `questions from Open Trivia DB…`,
  );

  const raw: OpenTdbResult[] = [];
  for (let i = 0; i < batches.length; i += 1) {
    if (i > 0) await sleep(REQUEST_SPACING_MS);
    const batch = batches[i];
    console.log(`  Requesting ${batch.amount} ${batch.type} questions…`);
    raw.push(...(await fetchBatch(batch)));
  }

  const questions = normalizeResults(raw);
  if (questions.length === 0) {
    throw new Error('No questions fetched — aborting without writing the file.');
  }
  validateQuestionsData(questions);

  writeFileSync(
    DEFAULT_QUESTIONS_PATH,
    `${JSON.stringify(questions, null, 2)}\n`,
    'utf-8',
  );
  console.log(
    `Wrote ${questions.length} questions to ${DEFAULT_QUESTIONS_PATH}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
