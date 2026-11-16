import type { ClientToServerEvents, ServerToClientEvents } from '@quiz/shared';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

export type QuizSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocket(): QuizSocket {
  return io({ autoConnect: true });
}
