import { useCallback, useEffect } from 'react';
import type { ObserverJoinAck, PublicGameState } from '@quiz/shared';
import { useGameState } from '../hooks/useGameState.js';
import { AnswerButton } from '../components/AnswerButton.js';
import { Countdown } from '../components/Countdown.js';
import { Leaderboard } from '../components/Leaderboard.js';
import { AnimatedLeaderboard } from '../components/AnimatedLeaderboard.js';
import { QRCode } from '../components/QRCode.js';

const HOST_CODE_KEY = 'quiz.hostCode';

function readStoredCode(): string | undefined {
  try {
    return localStorage.getItem(HOST_CODE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function storeCode(code: string): void {
  try {
    localStorage.setItem(HOST_CODE_KEY, code);
  } catch {
    void 0;
  }
}

export function HostPage() {
  const { socket, state, setState, error } = useGameState();

  const join = useCallback(
    (code?: string) => {
      socket.emit('hostJoin', { code }, (ack: ObserverJoinAck) => {
        if (ack.ok) {
          setState(ack.state);
          storeCode(ack.state.code);
        }
      });
    },
    [socket, setState],
  );

  useEffect(() => {
    join(readStoredCode());
  }, [join]);

  const startNewGame = useCallback(() => {
    try {
      localStorage.removeItem(HOST_CODE_KEY);
    } catch {
      void 0;
    }
    join(undefined);
  }, [join]);

  if (!state) {
    return (
      <main className="screen screen--center">
        <p>Connecting…</p>
      </main>
    );
  }

  return (
    <main className="screen">
      {error && <div className="error-banner">{error}</div>}
      <HostBody state={state} onNewGame={startNewGame} />
    </main>
  );
}

function joinUrl(code: string): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/play?code=${code}`;
}

function HostBody({
  state,
  onNewGame,
}: {
  state: PublicGameState;
  onNewGame: () => void;
}) {
  switch (state.phase) {
    case 'lobby':
      return <Lobby state={state} onNewGame={onNewGame} />;

    case 'question':
    case 'reveal': {
      const question = state.currentQuestion;
      if (!question) return null;
      const revealing = state.phase === 'reveal';
      return (
        <div className="stack">
          <div className="btn-row" style={{ justifyContent: 'space-between' }}>
            <span className="muted">
              Question {question.number} of {question.total}
            </span>
            <span className="muted">
              {state.answeredCount}/{state.playerCount} answered
            </span>
          </div>
          {!revealing && <Countdown endsAt={state.endsAt} />}
          <h1 className="question-text">{question.text}</h1>
          {question.imageUrl && (
            <img
              className="question-image"
              src={question.imageUrl}
              alt="Question image"
            />
          )}
          <div
            className={
              question.options.length <= 2
                ? 'answer-grid answer-grid--single'
                : 'answer-grid'
            }
          >
            {question.options.map((option, index) => (
              <AnswerButton
                key={index}
                index={index}
                label={option}
                disabled
                correct={
                  revealing
                    ? index === state.revealedCorrectIndex
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      );
    }

    case 'leaderboard':
      return (
        <div className="stack">
          <h1>Leaderboard</h1>
          <AnimatedLeaderboard rows={state.leaderboard} />
        </div>
      );

    case 'ended':
      return (
        <div className="stack">
          <h1>Final results</h1>
          {state.leaderboard[0] && (
            <p className="code-badge">🏆 {state.leaderboard[0].nickname}</p>
          )}
          <Leaderboard rows={state.leaderboard} />
          <button
            type="button"
            className="btn btn--primary"
            onClick={onNewGame}
          >
            New game
          </button>
        </div>
      );

    default:
      return null;
  }
}

function Lobby({
  state,
  onNewGame,
}: {
  state: PublicGameState;
  onNewGame: () => void;
}) {
  const url = joinUrl(state.code);
  return (
    <div className="stack">
      <h1>Join the quiz</h1>
      <p className="muted">
        Go to <strong>{url.replace(/^https?:\/\//, '')}</strong> or scan:
      </p>
      <QRCode value={url} />
      <p className="muted">Game code</p>
      <div className="code-badge">{state.code}</div>
      <h2>{state.playerCount} players</h2>
      <div className="player-chips">
        {state.players.map((player) => (
          <span
            key={player.id}
            className={`chip ${player.connected ? '' : 'muted'}`}
          >
            {player.nickname}
          </span>
        ))}
      </div>
      <button type="button" className="btn btn--ghost" onClick={onNewGame}>
        New game (new code)
      </button>
    </div>
  );
}
