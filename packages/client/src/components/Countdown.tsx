import { useEffect, useState } from 'react';

function remainingMs(endsAt: number | null): number {
  return endsAt === null ? 0 : Math.max(0, endsAt - Date.now());
}

/** Live seconds-remaining display driven by an absolute deadline. */
export function Countdown({ endsAt }: { endsAt: number | null }) {
  const [remaining, setRemaining] = useState(() => remainingMs(endsAt));

  useEffect(() => {
    if (endsAt === null) return undefined;
    setRemaining(remainingMs(endsAt));
    const id = setInterval(() => setRemaining(remainingMs(endsAt)), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  if (endsAt === null) return null;
  const seconds = Math.ceil(remaining / 1000);
  return (
    <div className={`countdown ${seconds <= 5 ? 'countdown--urgent' : ''}`}>
      {seconds}s
    </div>
  );
}
