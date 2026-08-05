import { createContext, useContext, type ReactNode } from 'react';
import type { QuizSocket } from './socket.js';

const SocketContext = createContext<QuizSocket | null>(null);

export function SocketProvider({
  socket,
  children,
}: {
  socket: QuizSocket;
  children: ReactNode;
}) {
  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

/** Access the shared socket. Throws if used outside a SocketProvider. */
export function useSocket(): QuizSocket {
  const socket = useContext(SocketContext);
  if (!socket) {
    throw new Error('useSocket must be used within a SocketProvider.');
  }
  return socket;
}
