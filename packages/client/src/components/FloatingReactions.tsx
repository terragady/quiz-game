import { useEffect, useState } from 'react';

import { useSocket } from '../SocketContext.js';

const FLOAT_MS = 2600;
const MAX_ON_SCREEN = 30;

interface FloatingReaction {
  id: number;
  emoji: string;
  nickname: string;
  left: number;
}

let nextId = 0;

export function FloatingReactions() {
  const socket = useSocket();
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const onReaction = ({
      emoji,
      nickname,
    }: {
      emoji: string;
      nickname: string;
    }) => {
      const id = nextId++;
      const left = 6 + Math.random() * 88;
      setReactions((current) =>
        [...current, { id, emoji, nickname, left }].slice(-MAX_ON_SCREEN),
      );
      const timer = setTimeout(() => {
        timers.delete(timer);
        setReactions((current) => current.filter((r) => r.id !== id));
      }, FLOAT_MS);
      timers.add(timer);
    };
    socket.on('reaction', onReaction);
    return () => {
      socket.off('reaction', onReaction);
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [socket]);

  return (
    <div className="floating-reactions" aria-hidden="true">
      {reactions.map((reaction) => (
        <span
          key={reaction.id}
          className="floating-reaction"
          style={{ left: `${reaction.left}%` }}
        >
          <span className="floating-reaction__emoji">{reaction.emoji}</span>
          <span className="floating-reaction__name">{reaction.nickname}</span>
        </span>
      ))}
    </div>
  );
}
