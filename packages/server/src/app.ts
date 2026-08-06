import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createServer, type Server as HttpServer } from 'node:http';
import express, { type Express } from 'express';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  InterServerEvents,
  Question,
  ServerToClientEvents,
  SocketData,
} from '@quiz/shared';
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
}

export function createGameServer(
  questionPool: Question[],
  options: GameServerOptions = {},
): GameServerHandles {
  const app = express();
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  if (options.clientDir && existsSync(options.clientDir)) {
    const indexHtml = join(options.clientDir, 'index.html');
    app.use(express.static(options.clientDir));
    app.get('*', (_req, res) => {
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
    cors: { origin: true },
  });

  const service = new GameService(io, questionPool, {
    startCountdownMs: options.startCountdownMs,
  });
  io.on('connection', (socket) => service.register(socket));

  return { app, httpServer, io, service };
}
