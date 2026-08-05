import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DEFAULT_SETTINGS,
  type CategorySummary,
  type GamePhase,
  type GameSettings,
  type ObserverJoinAck,
} from '@quiz/shared';
import { useGameState } from '../hooks/useGameState.js';
import { SettingsForm } from '../components/SettingsForm.js';

const ACTIVE_PHASES: GamePhase[] = ['question', 'reveal', 'leaderboard'];

export function AdminPage() {
  const { socket, state, setState, error } = useGameState();
  const [searchParams] = useSearchParams();

  const [code, setCode] = useState(
    (searchParams.get('code') ?? '').toUpperCase(),
  );
  const [joined, setJoined] = useState(false);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleJoin = (event: FormEvent) => {
    event.preventDefault();
    setJoinError(null);
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setJoinError('Enter the game code shown on the TV.');
      return;
    }
    socket.emit('adminJoin', { code: trimmed }, (ack: ObserverJoinAck) => {
      if (ack.ok) {
        setJoined(true);
        setState(ack.state);
        setCategories(ack.categories);
      } else {
        setJoinError(ack.error);
      }
    });
  };

  if (!joined) {
    return (
      <main className="screen screen--center">
        <form className="card" onSubmit={handleJoin}>
          <h1>Admin remote</h1>
          {joinError && <div className="error-banner">{joinError}</div>}
          <div className="field">
            <label htmlFor="admin-code">Game code</label>
            <input
              id="admin-code"
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="ABCD"
            />
          </div>
          <button type="submit" className="btn btn--primary btn--block">
            Connect
          </button>
        </form>
      </main>
    );
  }

  const phase: GamePhase = state?.phase ?? 'lobby';
  const isLobby = phase === 'lobby';
  const isActive = ACTIVE_PHASES.includes(phase);

  return (
    <main className="screen">
      {error && <div className="error-banner">{error}</div>}
      <div className="card">
        <h1>Admin remote</h1>
        <p className="muted">
          Game <strong>{state?.code ?? code}</strong> · {phaseLabel(phase)}
        </p>
        {phase === 'question' && state && (
          <p className="muted">
            {state.answeredCount}/{state.playerCount} answered
          </p>
        )}

        {isLobby && (
          <SettingsForm
            settings={settings}
            categories={categories}
            onChange={setSettings}
          />
        )}

        <div className="btn-row">
          <button
            type="button"
            className="btn btn--primary"
            data-testid="start-button"
            disabled={!isLobby}
            onClick={() => socket.emit('adminStart', settings)}
          >
            Start game
          </button>
          <button
            type="button"
            className="btn"
            data-testid="next-button"
            disabled={!isActive}
            onClick={() => socket.emit('adminNext')}
          >
            {nextLabel(phase)}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            data-testid="end-button"
            disabled={!isActive}
            onClick={() => socket.emit('adminEnd')}
          >
            End game
          </button>
        </div>

        {phase === 'ended' && (
          <p className="muted">
            Game over. Reload the TV screen to start a new game.
          </p>
        )}
      </div>
    </main>
  );
}

function phaseLabel(phase: GamePhase): string {
  const labels: Record<GamePhase, string> = {
    lobby: 'Waiting in lobby',
    question: 'Question in progress',
    reveal: 'Answer revealed',
    leaderboard: 'Showing leaderboard',
    ended: 'Finished',
  };
  return labels[phase];
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
