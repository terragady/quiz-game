import { useEffect, useRef, useState } from 'react';
import type { GamePhase, PublicGameState } from '@quiz/shared';
import { useSocket } from '../SocketContext.js';

/**
 * Subscribes to broadcast game state and error messages. Callers manage their
 * own join flow and can seed the initial state via `setState`.
 *
 * Errors are transient: a stale error is cleared automatically when the game
 * moves to a new phase, so a message from one round doesn't linger into the next.
 */
export function useGameState() {
  const socket = useSocket();
  const [state, setState] = useState<PublicGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastPhase = useRef<GamePhase | null>(null);

  useEffect(() => {
    const onState = (next: PublicGameState) => {
      if (lastPhase.current !== null && lastPhase.current !== next.phase) {
        setError(null);
      }
      lastPhase.current = next.phase;
      setState(next);
    };
    const onError = (message: string) => setError(message);
    socket.on('gameState', onState);
    socket.on('errorMessage', onError);
    return () => {
      socket.off('gameState', onState);
      socket.off('errorMessage', onError);
    };
  }, [socket]);

  return { socket, state, setState, error, setError };
}
