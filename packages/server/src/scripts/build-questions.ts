import { POOL_QUESTIONS_PATH } from '../questions/loader.js';
import { writeQuestionPool } from '../questions/buildPool.js';

function main(): void {
  const pool = writeQuestionPool();
  console.log(`Built ${pool.length} questions into ${POOL_QUESTIONS_PATH}`);
}

main();
