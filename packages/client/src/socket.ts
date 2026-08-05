import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@quiz/shared';

/** Client-side socket typed with the shared event contract (note the order). */
export type QuizSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Connect to the same origin that served the app. In development, Vite proxies
 * `/socket.io` to the backend; in production the backend serves both.
 */
export function createSocket(): QuizSocket {
  return io({ autoConnect: true });
}
