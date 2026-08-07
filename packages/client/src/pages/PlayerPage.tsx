import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BENIGN_ANSWER_ERRORS,
  MAX_NICKNAME_LENGTH,
  type AnswerResult,
  type JoinAck,
  type PlayerStats,
  type PublicGameState,
} from '@quiz/shared';
import { useSocket } from '../SocketContext.js';
import { AnswerButton } from '../components/AnswerButton.js';
import { Countdown } from '../components/Countdown.js';
import {
  clearSession,
  readSession,
  writeSession,
} from '../playerSession.js';
import { readNickname, writeNickname } from '../nicknameCookie.js';

const BENIGN_ANSWER_ERROR_SET = new Set<string>(BENIGN_ANSWER_ERRORS);

export function PlayerPage() {
  const socket = useSocket();
  const [searchParams] = useSearchParams();

  const storedRef = useRef(readSession());
  const stored = storedRef.current;
  // A code in the URL (e.g. from scanning a new game's QR code) always wins,
  // and we only auto-rejoin a stored session when it matches that code.
  const urlCode = (searchParams.get('code') ?? '').toUpperCase();
  const rejoinSession =
    stored && (!urlCode || urlCode === stored.code)
      ? { code: stored.code, playerId: stored.playerId }
      : null;

  const [code, setCode] = useState(
    (urlCode || stored?.code || '').toUpperCase(),
  );
  const [nickname, setNickname] = useState(
    stored?.nickname ?? readNickname() ?? '',
  );
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [state, setState] = useState<PublicGameState | null>(null);
  const [answer, setAnswer] = useState<{
    questionId: string;
    index: number;
  } | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejoining, setRejoining] = useState(Boolean(rejoinSession));

  const currentQuestionId = state?.currentQuestion?.id ?? null;
  const selectedIndex =
    answer && answer.questionId === currentQuestionId ? answer.index : null;
  const shownResult =
    result && result.questionId === currentQuestionId ? result : null;

  const sessionRef = useRef<{ code: string; playerId: string } | null>(
    rejoinSession,
  );

  useEffect(() => {
    if (!playerId) return undefined;

    const onState = (next: PublicGameState) => {
      setState((prev) => {
        if (prev && prev.phase !== next.phase) setError(null);
        return next;
      });
      if (next.phase === 'ended') clearSession();
    };
    const onAnswerResult = (next: AnswerResult) => setResult(next);
    const onError = (message: string) => {
      if (BENIGN_ANSWER_ERROR_SET.has(message)) return;
      setError(message);
    };

    socket.on('gameState', onState);
    socket.on('answerResult', onAnswerResult);
    socket.on('errorMessage', onError);

    return () => {
      socket.off('gameState', onState);
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
            clearSession();
            sessionRef.current = null;
          }
          setRejoining(false);
        },
      );
    },
    [socket],
  );

  useEffect(() => {
    const session = sessionRef.current;
    if (session) attemptRejoin(session.code, session.playerId);
  }, [attemptRejoin]);

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

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !socket.connected) {
        socket.connect();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [socket]);

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
          writeNickname(trimmedNickname);
          setPlayerId(ack.playerId);
          setState(ack.state);
        } else {
          setError(ack.error);
        }
      },
    );
  };

  const leaveGame = useCallback(() => {
    socket.emit('playerLeave');
    clearSession();
    sessionRef.current = null;
    setPlayerId(null);
    setState(null);
    setAnswer(null);
    setResult(null);
    setError(null);
    setRejoining(false);
  }, [socket]);

  const handleAnswer = (index: number) => {
    const question = state?.currentQuestion;
    if (state?.phase !== 'question' || !question || selectedIndex !== null) {
      return;
    }
    setAnswer({ questionId: question.id, index });
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
        result={shownResult}
        onAnswer={handleAnswer}
      />
      <button
        type="button"
        className="btn btn--ghost btn--small player-leave"
        onClick={leaveGame}
      >
        Leave game
      </button>
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

    case 'countdown':
      return (
        <div className="stack feedback">
          <h1>Get ready!</h1>
          <Countdown endsAt={state.endsAt} />
          <p className="muted">The first question is coming up…</p>
        </div>
      );

    case 'question': {
      const question = state.currentQuestion;
      if (!question) return <p className="center-text">Get ready…</p>;
      const locked = selectedIndex !== null;
      return (
        <div className="stack">
          <div className="question-meta">
            <span className="chip chip--category">{question.category}</span>
            <span className="muted">
              Question {question.number} of {question.total}
            </span>
          </div>
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
                hideLetter
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
