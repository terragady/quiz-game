import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  categoryIcon,
  type GamePhase,
  type GameSettings,
  type ObserverJoinAck,
  type PublicGameState,
} from '@quiz/shared';
import { useGameState } from '../hooks/useGameState.js';
import { useToasts } from '../hooks/useToasts.js';
import { AnswerButton } from '../components/AnswerButton.js';
import { Countdown } from '../components/Countdown.js';
import { CategoryReel } from '../components/CategoryReel.js';
import { Confetti } from '../components/Confetti.js';
import { FinalResults } from '../components/FinalResults.js';
import { AnimatedLeaderboard } from '../components/AnimatedLeaderboard.js';
import { QRCode } from '../components/QRCode.js';
import { SettingsForm } from '../components/SettingsForm.js';
import { ToastStack } from '../components/ToastStack.js';
import { FloatingReactions } from '../components/FloatingReactions.js';
import { SoundToggle } from '../components/SoundToggle.js';
import { useHostSounds } from '../hooks/useHostSounds.js';
import { unlockAudio } from '../audio.js';
import { TunePlayer } from '../components/TunePlayer.js';
import {
  getSettingsErrors,
  hasSettingsErrors,
} from '../settingsValidation.js';

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
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();
  const connectedRef = useRef<Map<string, boolean> | null>(null);
  useHostSounds(state);

  useEffect(() => {
    if (!state) {
      connectedRef.current = null;
      return;
    }
    const previous = connectedRef.current;
    const active = state.phase !== 'lobby' && state.phase !== 'ended';
    if (previous && active) {
      for (const player of state.players) {
        if (previous.get(player.id) === true && !player.connected) {
          pushToast(`${player.nickname} disconnected`);
        }
      }
    }
    connectedRef.current = new Map(
      state.players.map((player) => [player.id, player.connected]),
    );
  }, [state, pushToast]);

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

  useEffect(() => {
    if (!state) return;
    if (state.phase === 'ended') {
      try {
        localStorage.removeItem(HOST_CODE_KEY);
      } catch {
        void 0;
      }
    } else if (state.phase === 'lobby') {
      // Back in the lobby after "Play again": remember the room again so
      // refreshing the TV keeps it.
      storeCode(state.code);
    }
  }, [state?.phase, state?.code]);

  const startNewGame = useCallback(() => {
    try {
      localStorage.removeItem(HOST_CODE_KEY);
    } catch {
      void 0;
    }
    join(undefined);
  }, [join]);

  const playAgain = useCallback(() => {
    void unlockAudio();
    socket.emit('hostPlayAgain');
  }, [socket]);

  const startGame = useCallback(() => {
    void unlockAudio();
    socket.emit('hostStart', settings);
  }, [socket, settings]);

  const nextStep = useCallback(() => {
    void unlockAudio();
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

  const showingQuestion =
    state.phase === 'question' || state.phase === 'reveal';

  return (
    <main
      className={`screen screen--host${showingQuestion ? ' screen--fit' : ''}`}
    >
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <FloatingReactions />
      <SoundToggle />
      {error && <div className="error-banner">{error}</div>}
      <HostBody
        state={state}
        settings={settings}
        onSettingsChange={setSettings}
        onStart={startGame}
        onNext={nextStep}
        onEnd={endGame}
        onNewGame={startNewGame}
        onPlayAgain={playAgain}
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
  settings,
  onSettingsChange,
  onStart,
  onNext,
  onEnd,
  onNewGame,
  onPlayAgain,
}: {
  state: PublicGameState;
  settings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
  onStart: () => void;
  onNext: () => void;
  onEnd: () => void;
  onNewGame: () => void;
  onPlayAgain: () => void;
}) {
  switch (state.phase) {
    case 'lobby':
      return (
        <Lobby
          state={state}
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

    case 'intro': {
      const upcoming = state.upcoming;
      if (!upcoming) return null;
      return (
        <div className="stack screen--center intro">
          <p className="intro__number">
            Question {upcoming.number} of {upcoming.total}
          </p>
          <CategoryReel key={upcoming.number} category={upcoming.category} />
        </div>
      );
    }

    case 'question':
    case 'reveal': {
      const question = state.currentQuestion;
      if (!question) return null;
      const revealing = state.phase === 'reveal';
      const voters = state.optionVoters;
      const counts = state.optionCounts;
      return (
        <div
          className={`stack question-stack${
            question.imageUrl ? ' question-stack--with-image' : ''
          }`}
        >
          <div className="question-meta question-meta--wide">
            <span className="chip chip--category">
              {categoryIcon(question.category)} {question.category}
            </span>
            <span className="muted">
              Question {question.number} of {question.total}
            </span>
            <span className="muted">
              {state.answeredCount}/{state.playerCount} answered
            </span>
          </div>
          {!revealing && <Countdown endsAt={state.endsAt} />}
          <h1 className="question-text">{question.text}</h1>
          {question.melody && !revealing && (
            <TunePlayer melody={question.melody} />
          )}
          {question.imageUrl && (
            <div className="question-image-frame">
              <img
                className="question-image"
                src={question.imageUrl}
                alt="Question image"
              />
            </div>
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
                voters={revealing && voters ? voters[index] : undefined}
                voteCount={revealing && counts ? counts[index] : undefined}
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
          <FinalResults rows={state.leaderboard} />
          <div className="host-controls">
            <button
              type="button"
              className="btn btn--primary"
              onClick={onPlayAgain}
            >
              Play again
            </button>
            <button type="button" className="btn btn--ghost" onClick={onNewGame}>
              New game
            </button>
          </div>
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
  settings,
  onSettingsChange,
  onStart,
}: {
  state: PublicGameState;
  settings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
  onStart: () => void;
}) {
  const url = joinUrl(state.code);
  const settingsErrors = getSettingsErrors(settings);
  const settingsInvalid = hasSettingsErrors(settingsErrors);
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
              className={`chip chip--float${player.connected ? '' : ' muted'}`}
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
          errors={settingsErrors}
          onChange={onSettingsChange}
        />
        <button
          type="button"
          className="btn btn--primary btn--block"
          data-testid="start-button"
          disabled={state.playerCount === 0 || settingsInvalid}
          onClick={onStart}
        >
          Start game
        </button>
        {state.playerCount === 0 && (
          <p className="muted center-text">
            Waiting for at least one player to join…
          </p>
        )}
        {state.playerCount > 0 && settingsInvalid && (
          <p className="muted center-text">
            Fix the highlighted settings to start.
          </p>
        )}
      </div>
    </div>
  );
}
