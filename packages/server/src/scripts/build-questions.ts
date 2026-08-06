/**
 * Merge the question source files (curated + Open Trivia DB + The Trivia API)
 * into the single committed pool the server reads, de-duplicating by id and by
 * question text and validating the result.
 *
 *   npm run questions:build
 *
 * The importers run this automatically after fetching, so you normally only run
 * it by hand after editing the curated questions.
 */
import { POOL_QUESTIONS_PATH } from '../questions/loader.js';
import { writeQuestionPool } from '../questions/buildPool.js';

function main(): void {
  const pool = writeQuestionPool();
  console.log(`Built ${pool.length} questions into ${POOL_QUESTIONS_PATH}`);
}

main();
