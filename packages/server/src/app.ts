import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import { join } from 'node:path';

import type {
  ClientToServerEvents,
  InterServerEvents,
  Question,
  ServerToClientEvents,
  SocketData,
} from '@quiz/shared';
import express from 'express';
import type { Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import { Server } from 'socket.io';

import { GameService } from './game/GameService.js';

export interface GameServerHandles {
  app: Express;
  httpServer: HttpServer;
  io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >;
  service: GameService;
}

export interface GameServerOptions {
  clientDir?: string;
  startCountdownMs?: number;
  introMs?: number;
  corsOrigin?: string | string[] | boolean;
}

export function createGameServer(
  questionPool: Question[],
  options: GameServerOptions = {},
): GameServerHandles {
  const app = express();
  // Render (and most PaaS providers) put a reverse proxy in front of the app,
  // so the client IP arrives in the X-Forwarded-For header. Trust the first
  // proxy hop so express-rate-limit can identify clients correctly.
  app.set('trust proxy', 1);
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  if (options.clientDir && existsSync(options.clientDir)) {
    const indexHtml = join(options.clientDir, 'index.html');
    app.use(express.static(options.clientDir));
    const spaFallbackLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 1000,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    });
    app.get('/*splat', spaFallbackLimiter, (_req, res) => {
      res.sendFile(indexHtml);
    });
  }

  const httpServer = createServer(app);
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: { origin: options.corsOrigin ?? true },
  });

  const service = new GameService(io, questionPool, {
    startCountdownMs: options.startCountdownMs,
    introMs: options.introMs,
  });
  io.on('connection', (socket) => service.register(socket));

  return { app, httpServer, io, service };
}
