import { useEffect, useState } from 'react';

function remainingMs(endsAt: number): number {
  return Math.max(0, endsAt - Date.now());
}

function CountdownTimer({ endsAt }: { endsAt: number }) {
  const [remaining, setRemaining] = useState(() => remainingMs(endsAt));

  useEffect(() => {
    const id = setInterval(() => setRemaining(remainingMs(endsAt)), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const seconds = Math.ceil(remaining / 1000);
  return (
    <div className={`countdown ${seconds <= 5 ? 'countdown--urgent' : ''}`}>
      {seconds}s
    </div>
  );
}

export function Countdown({ endsAt }: { endsAt: number | null }) {
  if (endsAt === null) {
    return null;
  }
  // A new deadline remounts the timer, so it starts from the right number.
  return <CountdownTimer key={endsAt} endsAt={endsAt} />;
}
