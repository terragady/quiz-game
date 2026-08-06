import { writeFileSync } from 'node:fs';
import type { Question } from '@quiz/shared';
import {
  POOL_QUESTIONS_PATH,
  buildQuestionPool,
  validateQuestionsData,
} from './loader.js';

/**
 * Build the merged, de-duplicated question pool from the source files, validate
 * it, and write it to the committed pool file the server reads. Returns the
 * questions written.
 */
export function writeQuestionPool(poolPath: string = POOL_QUESTIONS_PATH): Question[] {
  const pool = buildQuestionPool();
  validateQuestionsData(pool);
  writeFileSync(poolPath, `${JSON.stringify(pool, null, 2)}\n`, 'utf-8');
  return pool;
}
