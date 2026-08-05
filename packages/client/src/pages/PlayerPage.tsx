import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MAX_NICKNAME_LENGTH,
  type AnswerResult,
  type JoinAck,
  type PublicGameState,
} from '@quiz/shared';
import { useSocket } from '../SocketContext.js';
import { AnswerButton } from '../components/AnswerButton.js';

export function PlayerPage() {
  const socket = useSocket();
  const [searchParams] = useSearchParams();

  const [code, setCode] = useState(
    (searchParams.get('code') ?? '').toUpperCase(),
  );
  const [nickname, setNickname] = useState('');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [state, setState] = useState<PublicGameState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) return undefined;

    const onState = (next: PublicGameState) => setState(next);
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

    case 'leaderboard':
    case 'ended': {
      const me = state.leaderboard.find((row) => row.playerId === playerId);
      return (
        <div className="stack feedback">
          <h1>{state.phase === 'ended' ? 'Final score' : 'Standings'}</h1>
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
          {state.phase === 'ended' && (
            <p className="muted">Thanks for playing!</p>
          )}
        </div>
      );
    }

    default:
      return null;
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
