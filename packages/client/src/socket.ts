import type { ClientToServerEvents, ServerToClientEvents } from '@quiz/shared';
import { io, type Socket } from 'socket.io-client';

export type QuizSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocket(): QuizSocket {
  return io({ autoConnect: true });
}
