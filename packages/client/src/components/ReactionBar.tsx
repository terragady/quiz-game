import { REACTIONS } from '@quiz/shared';

import { useSocket } from '../SocketContext.js';

// Lets a player send an emoji to the big screen.
export function ReactionBar() {
  const socket = useSocket();
  return (
    <div className="reaction-bar" role="group" aria-label="Send a reaction">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="reaction-bar__button"
          onClick={() => socket.emit('sendReaction', emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
