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
  /**
   * Directory of the built client (packages/client/dist). When provided and
   * present on disk, the server serves it as static files with an SPA fallback
   * so the whole app runs from a single origin.
   */
  clientDir?: string;
}

/**
 * Build the HTTP + Socket.IO server around a question pool.
 * Does not start listening — the caller decides the port.
 */
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
    // SPA fallback: any non-API GET returns index.html so client routes work.
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
    // Same-origin in production; permissive in development for the Vite proxy.
    cors: { origin: true },
  });

  const service = new GameService(io, questionPool);
  io.on('connection', (socket) => service.register(socket));

  return { app, httpServer, io, service };
}
