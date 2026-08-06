import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@quiz/shared';

export type QuizSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocket(): QuizSocket {
  return io({ autoConnect: true });
}
