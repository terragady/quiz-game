import { writeQuestionPool } from '../questions/buildPool.js';
import { POOL_QUESTIONS_PATH } from '../questions/loader.js';

function main(): void {
  const pool = writeQuestionPool();
  console.log(`Built ${pool.length} questions into ${POOL_QUESTIONS_PATH}`);
}

main();
