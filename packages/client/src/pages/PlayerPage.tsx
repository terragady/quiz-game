import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MAX_NICKNAME_LENGTH,
  type AnswerResult,
  type JoinAck,
  type PlayerStats,
  type PublicGameState,
} from '@quiz/shared';
import { useSocket } from '../SocketContext.js';
import { AnswerButton } from '../components/AnswerButton.js';
import {
  clearSession,
  readSession,
  writeSession,
} from '../playerSession.js';

export function PlayerPage() {
  const socket = useSocket();
  const [searchParams] = useSearchParams();

  const storedRef = useRef(readSession());
  const stored = storedRef.current;

  const [code, setCode] = useState(
    (stored?.code ?? searchParams.get('code') ?? '').toUpperCase(),
  );
  const [nickname, setNickname] = useState(stored?.nickname ?? '');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [state, setState] = useState<PublicGameState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejoining, setRejoining] = useState(Boolean(stored));

  // The live session used by the reconnect handler; kept in a ref so it never
  // goes stale inside the long-lived socket 'connect' listener.
  const sessionRef = useRef<{ code: string; playerId: string } | null>(
    stored ? { code: stored.code, playerId: stored.playerId } : null,
  );

  useEffect(() => {
    if (!playerId) return undefined;

    const onState = (next: PublicGameState) => {
      setState(next);
      // Once the game is over, forget the saved session so a later fresh visit
      // starts at the join form (in-memory reconnect still works this session).
      if (next.phase === 'ended') clearSession();
    };
    const onQuestionStarted = () => {
      setSelectedIndex(null);
      setResult(null);
    };
    const onAnswerResult = (next: AnswerResult) => setResult(next);
    const onError = (message: string) => setError(message);

    socket.on('gameState', onState);
    socket.on('questionStarted', onQuestionStarted);
    socket.on('answerResult', onAnswerResult);
    socket.on('errorMessage', onError);

    return () => {
      socket.off('gameState', onState);
      socket.off('questionStarted', onQuestionStarted);
      socket.off('answerResult', onAnswerResult);
      socket.off('errorMessage', onError);
    };
  }, [socket, playerId]);

  const attemptRejoin = useCallback(
    (rejoinCode: string, rejoinPlayerId: string) => {
      socket.emit(
        'playerRejoin',
        { code: rejoinCode, playerId: rejoinPlayerId },
        (ack: JoinAck) => {
          if (ack.ok) {
            sessionRef.current = { code: rejoinCode, playerId: ack.playerId };
            setPlayerId(ack.playerId);
            setState(ack.state);
          } else {
            // The room or player is gone — drop the stale session.
            clearSession();
            sessionRef.current = null;
          }
          setRejoining(false);
        },
      );
    },
    [socket],
  );

  // On first mount, resume a saved session if one exists.
  useEffect(() => {
    const session = sessionRef.current;
    if (session) attemptRejoin(session.code, session.playerId);
    // Runs only on mount; the reconnect listener below covers later reconnects.
  }, [attemptRejoin]);

  // Re-attach to the game whenever the socket (re)connects — this is what
  // recovers a phone that dropped its connection while the screen was off.
  useEffect(() => {
    const onConnect = () => {
      const session = sessionRef.current;
      if (session) attemptRejoin(session.code, session.playerId);
    };
    socket.on('connect', onConnect);
    return () => {
      socket.off('connect', onConnect);
    };
  }, [socket, attemptRejoin]);

  const handleJoin = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const trimmedCode = code.trim().toUpperCase();
    const trimmedNickname = nickname.trim();
    if (!trimmedCode || !trimmedNickname) {
      setError('Enter a game code and a nickname.');
      return;
    }
    socket.emit(
      'playerJoin',
      { code: trimmedCode, nickname: trimmedNickname },
      (ack: JoinAck) => {
        if (ack.ok) {
          sessionRef.current = { code: trimmedCode, playerId: ack.playerId };
          writeSession({
            code: trimmedCode,
            playerId: ack.playerId,
            nickname: trimmedNickname,
          });
          setPlayerId(ack.playerId);
          setState(ack.state);
        } else {
          setError(ack.error);
        }
      },
    );
  };

  const handleAnswer = (index: number) => {
    if (state?.phase !== 'question' || selectedIndex !== null) return;
    setSelectedIndex(index);
    socket.emit('submitAnswer', { optionIndex: index });
  };

  if (!playerId && rejoining) {
    return (
      <main className="screen screen--center">
        <p className="center-text">Reconnecting…</p>
      </main>
    );
  }

  if (!playerId) {
    return (
      <main className="screen screen--center">
        <form className="card" onSubmit={handleJoin}>
          <h1>Join the quiz</h1>
          {error && <div className="error-banner">{error}</div>}
          <div className="field">
            <label htmlFor="code">Game code</label>
            <input
              id="code"
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="ABCD"
            />
          </div>
          <div className="field">
            <label htmlFor="nickname">Nickname</label>
            <input
              id="nickname"
              className="input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={MAX_NICKNAME_LENGTH}
              autoComplete="off"
              placeholder="Your name"
            />
          </div>
          <button type="submit" className="btn btn--primary btn--block">
            Join
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="screen">
      {error && <div className="error-banner">{error}</div>}
      <PlayerBody
        state={state}
        playerId={playerId}
        selectedIndex={selectedIndex}
        result={result}
        onAnswer={handleAnswer}
      />
    </main>
  );
}

function PlayerBody({
  state,
  playerId,
  selectedIndex,
  result,
  onAnswer,
}: {
  state: PublicGameState | null;
  playerId: string;
  selectedIndex: number | null;
  result: AnswerResult | null;
  onAnswer: (index: number) => void;
}) {
  if (!state) {
    return <p className="center-text">Joining…</p>;
  }

  switch (state.phase) {
    case 'lobby':
      return (
        <div className="stack">
          <h1>You&apos;re in!</h1>
          <p className="muted">Waiting for the host to start the quiz…</p>
          <p className="chip">{state.playerCount} players joined</p>
        </div>
      );

    case 'question': {
      const question = state.currentQuestion;
      if (!question) return <p className="center-text">Get ready…</p>;
      const locked = selectedIndex !== null;
      return (
        <div className="stack">
          <p className="muted">
            Question {question.number} of {question.total}
          </p>
          {locked ? (
            <p className="center-text">
              Answer locked in — sit tight!
            </p>
          ) : (
            <p className="center-text">Tap your answer</p>
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
                disabled={locked}
                selected={selectedIndex === index}
                onSelect={() => onAnswer(index)}
              />
            ))}
          </div>
        </div>
      );
    }

    case 'reveal':
      return <RevealFeedback result={result} />;

    case 'leaderboard': {
      const me = state.leaderboard.find((row) => row.playerId === playerId);
      return (
        <div className="stack feedback">
          <h1>Standings</h1>
          {me ? (
            <>
              <p className="feedback__points">{me.score}</p>
              <p className="muted">
                Rank {me.rank} of {state.leaderboard.length}
              </p>
            </>
          ) : (
            <p className="muted">Waiting for scores…</p>
          )}
        </div>
      );
    }

    case 'ended': {
      const me = state.leaderboard.find((row) => row.playerId === playerId);
      if (!me) {
        return (
          <div className="stack feedback">
            <h1>Game over</h1>
            <p className="muted">Thanks for playing!</p>
          </div>
        );
      }
      return (
        <div className="stack feedback">
          <h1>Game over</h1>
          <p className="place-badge">
            {placeEmoji(me.rank)} {ordinal(me.rank)} place
          </p>
          <p className="muted">out of {state.leaderboard.length} players</p>
          <p className="feedback__points">{me.score}</p>
          <p className="muted">points</p>
          {me.stats && <StatsPanel stats={me.stats} />}
        </div>
      );
    }

    default:
      return null;
  }
}

function StatsPanel({ stats }: { stats: PlayerStats }) {
  return (
    <dl className="stats-grid">
      <Stat label="Correct" value={String(stats.correct)} tone="good" />
      <Stat label="Incorrect" value={String(stats.incorrect)} tone="bad" />
      <Stat label="No answer" value={String(stats.unanswered)} />
      <Stat label="Avg. reply" value={formatSeconds(stats.averageResponseMs)} />
      <Stat
        label="Fastest correct"
        value={formatSeconds(stats.fastestCorrectMs)}
      />
    </dl>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad';
}) {
  return (
    <div className={`stat ${tone ? `stat--${tone}` : ''}`}>
      <dt className="stat__value">{value}</dt>
      <dd className="stat__label">{label}</dd>
    </div>
  );
}

function formatSeconds(ms: number | null): string {
  if (ms === null) return '—';
  return `${(ms / 1000).toFixed(1)}s`;
}

function ordinal(rank: number): string {
  const rem100 = rank % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

function placeEmoji(rank: number): string {
  switch (rank) {
    case 1:
      return '🥇';
    case 2:
      return '🥈';
    case 3:
      return '🥉';
    default:
      return '🎉';
  }
}

function RevealFeedback({ result }: { result: AnswerResult | null }) {
  if (!result) {
    return <p className="center-text">Checking answers…</p>;
  }
  return (
    <div
      className={`stack feedback ${
        result.correct ? 'feedback--correct' : 'feedback--wrong'
      }`}
    >
      <h1>{result.correct ? 'Correct!' : 'Not quite'}</h1>
      <p className="feedback__points">
        {result.pointsAwarded > 0 ? `+${result.pointsAwarded}` : '+0'}
      </p>
      <p className="muted">
        Total {result.totalScore} · Rank {result.rank}
      </p>
    </div>
  );
}
