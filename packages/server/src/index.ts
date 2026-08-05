import { fileURLToPath } from 'node:url';
import { createGameServer } from './app.js';
import { loadQuestions } from './questions/loader.js';

const questions = loadQuestions();

// Built client lives at packages/client/dist relative to this file.
const clientDir = fileURLToPath(new URL('../../client/dist', import.meta.url));
const { httpServer } = createGameServer(questions, { clientDir });

const port = Number(process.env.PORT ?? 3000);
httpServer.listen(port, () => {
  console.log(`Quiz server listening on http://localhost:${port}`);
  console.log(`Loaded ${questions.length} questions.`);
});
