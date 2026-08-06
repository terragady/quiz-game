import { fileURLToPath } from 'node:url';
import { createGameServer } from './app.js';
import { loadQuestionPool } from './questions/loader.js';

const questions = loadQuestionPool();

const clientDir = fileURLToPath(new URL('../../client/dist', import.meta.url));
const { httpServer } = createGameServer(questions, { clientDir });

const port = Number(process.env.PORT ?? 3000);
httpServer.listen(port, () => {
  console.log(`Quiz server listening on http://localhost:${port}`);
  console.log(`Loaded ${questions.length} questions.`);
});
