import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  type CategorySummary,
  type GamePhase,
  type GameSettings,
  type ObserverJoinAck,
  type PublicGameState,
} from '@quiz/shared';
import { useGameState } from '../hooks/useGameState.js';
import { AnswerButton } from '../components/AnswerButton.js';
import { Countdown } from '../components/Countdown.js';
import { Confetti } from '../components/Confetti.js';
import { Leaderboard } from '../components/Leaderboard.js';
import { AnimatedLeaderboard } from '../components/AnimatedLeaderboard.js';
import { QRCode } from '../components/QRCode.js';
import { SettingsForm } from '../components/SettingsForm.js';

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
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);

  const join = useCallback(
    (code?: string) => {
      socket.emit('hostJoin', { code }, (ack: ObserverJoinAck) => {
        if (ack.ok) {
          setState(ack.state);
          setCategories(ack.categories);
          storeCode(ack.state.code);
        }
      });
    },
    [socket, setState],
  );

  useEffect(() => {
    join(readStoredCode());
  }, [join]);

  useEffect(() => {
    if (state?.phase === 'ended') {
      try {
        localStorage.removeItem(HOST_CODE_KEY);
      } catch {
        void 0;
      }
    }
  }, [state?.phase]);

  const startNewGame = useCallback(() => {
    try {
      localStorage.removeItem(HOST_CODE_KEY);
    } catch {
      void 0;
    }
    join(undefined);
  }, [join]);

  const startGame = useCallback(() => {
    socket.emit('hostStart', settings);
  }, [socket, settings]);

  const nextStep = useCallback(() => {
    socket.emit('hostNext');
  }, [socket]);

  const endGame = useCallback(() => {
    socket.emit('hostEnd');
  }, [socket]);

  if (!state) {
    return (
      <main className="screen screen--center">
        <p>Connecting…</p>
      </main>
    );
  }

  return (
    <main className="screen screen--host">
      {error && <div className="error-banner">{error}</div>}
      <HostBody
        state={state}
        categories={categories}
        settings={settings}
        onSettingsChange={setSettings}
        onStart={startGame}
        onNext={nextStep}
        onEnd={endGame}
        onNewGame={startNewGame}
      />
    </main>
  );
}

function joinUrl(code: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/play?code=${code}`;
}

function HostBody({
  state,
  categories,
  settings,
  onSettingsChange,
  onStart,
  onNext,
  onEnd,
  onNewGame,
}: {
  state: PublicGameState;
  categories: CategorySummary[];
  settings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
  onStart: () => void;
  onNext: () => void;
  onEnd: () => void;
  onNewGame: () => void;
}) {
  switch (state.phase) {
    case 'lobby':
      return (
        <Lobby
          state={state}
          categories={categories}
          settings={settings}
          onSettingsChange={onSettingsChange}
          onStart={onStart}
        />
      );

    case 'countdown':
      return (
        <div className="stack screen--center">
          <h1>Get ready!</h1>
          <Countdown endsAt={state.endsAt} />
          <p className="muted">The quiz is about to start…</p>
        </div>
      );

    case 'question':
    case 'reveal': {
      const question = state.currentQuestion;
      if (!question) return null;
      const revealing = state.phase === 'reveal';
      const counts = state.optionCounts;
      const totalAnswers =
        counts?.reduce((sum, value) => sum + value, 0) ?? 0;
      return (
        <div className="stack question-stack">
          <div className="question-meta question-meta--wide">
            <span className="chip chip--category">{question.category}</span>
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
                  revealing ? index === state.revealedCorrectIndex : undefined
                }
                count={revealing && counts ? counts[index] : undefined}
                share={
                  revealing && counts
                    ? totalAnswers > 0
                      ? counts[index] / totalAnswers
                      : 0
                    : undefined
                }
              />
            ))}
          </div>
          <HostControls phase={state.phase} onNext={onNext} onEnd={onEnd} />
        </div>
      );
    }

    case 'leaderboard':
      return (
        <div className="stack">
          <h1>Leaderboard</h1>
          <AnimatedLeaderboard rows={state.leaderboard} />
          <HostControls phase={state.phase} onNext={onNext} onEnd={onEnd} />
        </div>
      );

    case 'ended':
      return (
        <div className="stack">
          <Confetti />
          <h1>Final results</h1>
          {state.leaderboard[0] && (
            <p className="code-badge">🏆 {state.leaderboard[0].nickname}</p>
          )}
          <Leaderboard rows={state.leaderboard} />
          <button type="button" className="btn btn--primary" onClick={onNewGame}>
            New game
          </button>
        </div>
      );

    default:
      return null;
  }
}

function HostControls({
  phase,
  onNext,
  onEnd,
}: {
  phase: GamePhase;
  onNext: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="host-controls">
      <button type="button" className="btn btn--primary" onClick={onNext}>
        {nextLabel(phase)}
      </button>
      <button type="button" className="btn btn--ghost" onClick={onEnd}>
        End game
      </button>
    </div>
  );
}

function nextLabel(phase: GamePhase): string {
  switch (phase) {
    case 'question':
      return 'Reveal answers';
    case 'reveal':
      return 'Show leaderboard';
    case 'leaderboard':
      return 'Next question';
    default:
      return 'Next';
  }
}

function Lobby({
  state,
  categories,
  settings,
  onSettingsChange,
  onStart,
}: {
  state: PublicGameState;
  categories: CategorySummary[];
  settings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
  onStart: () => void;
}) {
  const url = joinUrl(state.code);
  return (
    <div className="lobby-layout">
      <div className="lobby-join stack">
        <h1>Join the quiz</h1>
        <p className="muted">
          Go to <strong>{url.replace(/^https?:\/\//, '')}</strong> or scan:
        </p>
        <QRCode value={url} />
        <p className="muted">Game code</p>
        <div className="code-badge">{state.code}</div>
        <h2>{state.playerCount} players</h2>
        <div className="player-chips player-chips--floating">
          {state.players.map((player, index) => (
            <span
              key={player.id}
              className={`chip chip--float ${player.connected ? '' : 'muted'}`}
              style={{ animationDelay: `${(index % 6) * 0.4}s` }}
            >
              {player.nickname}
            </span>
          ))}
        </div>
      </div>
      <div className="lobby-setup card">
        <h2>Game settings</h2>
        <SettingsForm
          settings={settings}
          categories={categories}
          onChange={onSettingsChange}
        />
        <button
          type="button"
          className="btn btn--primary btn--block"
          data-testid="start-button"
          disabled={state.playerCount === 0}
          onClick={onStart}
        >
          Start game
        </button>
        {state.playerCount === 0 && (
          <p className="muted center-text">
            Waiting for at least one player to join…
          </p>
        )}
      </div>
    </div>
  );
}
