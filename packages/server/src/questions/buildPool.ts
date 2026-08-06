import { writeFileSync } from 'node:fs';
import type { Question } from '@quiz/shared';
import {
  POOL_QUESTIONS_PATH,
  buildQuestionPool,
  validateQuestionsData,
} from './loader.js';

export function writeQuestionPool(poolPath: string = POOL_QUESTIONS_PATH): Question[] {
  const pool = buildQuestionPool();
  validateQuestionsData(pool);
  writeFileSync(poolPath, `${JSON.stringify(pool, null, 2)}\n`, 'utf-8');
  return pool;
}
