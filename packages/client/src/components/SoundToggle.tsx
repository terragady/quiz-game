import { useState } from 'react';
import { isMuted, setMuted } from '../audio.js';

export function SoundToggle() {
  const [muted, setMutedState] = useState(isMuted);
  return (
    <button
      type="button"
      className="sound-toggle"
      aria-pressed={!muted}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      onClick={() => {
        setMuted(!muted);
        setMutedState(!muted);
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
