import { fileURLToPath } from 'node:url';
import { createGameServer } from './app.js';
import { loadQuestionPool } from './questions/loader.js';

const questions = loadQuestionPool();

const clientDir = fileURLToPath(new URL('../../client/dist', import.meta.url));
const allowedOrigins = [
  ...new Set(
    (process.env.CLIENT_ORIGIN ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  ),
];
const corsOrigin = allowedOrigins.length > 0 ? allowedOrigins : undefined;
const { httpServer } = createGameServer(questions, { clientDir, corsOrigin });

const port = Number(process.env.PORT ?? 3000);
httpServer.listen(port, () => {
  console.log(`Quiz server listening on http://localhost:${port}`);
  console.log(`Loaded ${questions.length} questions.`);
});
