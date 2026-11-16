import { useState } from 'react';

import { isMuted, setMuted as saveMuted } from '../audio.js';

export function SoundToggle() {
  const [muted, setMuted] = useState(isMuted);
  return (
    <button
      type="button"
      className="sound-toggle"
      aria-pressed={!muted}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      onClick={() => {
        saveMuted(!muted);
        setMuted(!muted);
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
