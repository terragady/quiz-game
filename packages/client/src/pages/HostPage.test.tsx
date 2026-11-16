import type { PublicGameState } from '@quiz/shared';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SocketProvider } from '../SocketContext.js';
import { FakeSocket } from '../test/fakeSocket.js';
import { HostPage } from './HostPage.js';

function baseState(overrides: Partial<PublicGameState> = {}): PublicGameState {
  return {
    code: 'WXYZ',
    phase: 'lobby',
    settings: {
      questionCount: 3,
      secondsPerQuestion: 20,
      categories: [],
      difficulty: null,
      autoAdvance: false,
      revealSeconds: 5,
      leaderboardSeconds: 8,
      categoryIntro: false,
      showVoters: true,
      wrongAnswerPenalty: false,
      musicQuestions: false,
    },
    players: [],
    currentQuestion: null,
    revealedCorrectIndex: null,
    endsAt: null,
    answeredCount: 0,
    playerCount: 0,
    upcoming: null,
    optionCounts: null,
    optionVoters: null,
    leaderboard: [],
    ...overrides,
  };
}

function renderHost(fake: FakeSocket) {
  return render(
    <SocketProvider socket={fake.asSocket()}>
      <HostPage />
    </SocketProvider>,
  );
}

describe('HostPage', () => {
  let fake: FakeSocket;

  beforeEach(() => {
    localStorage.clear();
    fake = new FakeSocket();
    fake.respondToAck('hostJoin', () => ({
      ok: true,
      state: baseState({
        players: [
          {
            id: 'p1',
            nickname: 'Alice',
            score: 0,
            connected: true,
            hasAnswered: false,
          },
        ],
        playerCount: 1,
      }),
      categories: [{ name: 'Science', count: 5 }],
    }));
  });

  it('joins as host and shows the code, join URL, and players', () => {
    renderHost(fake);

    expect(fake.emittedArgs('hostJoin')).toHaveLength(1);
    expect(screen.getByText('WXYZ')).toBeInTheDocument();
    expect(screen.getByText(/\/play\?code=WXYZ/)).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('lets the host configure settings and start the game from the lobby', async () => {
    const user = userEvent.setup();
    renderHost(fake);

    const startButton = screen.getByTestId('start-button');
    expect(startButton).toBeEnabled();
    await user.click(startButton);

    expect(fake.emittedArgs('hostStart')).toHaveLength(1);
  });

  it('disables Start when a settings field is cleared and shows a hint', async () => {
    const user = userEvent.setup();
    renderHost(fake);

    await user.clear(screen.getByLabelText('Number of questions'));

    expect(screen.getByTestId('start-button')).toBeDisabled();
    expect(
      screen.getByText('Fix the highlighted settings to start.'),
    ).toBeInTheDocument();
  });

  it('shows a toast when a player disconnects during play', async () => {
    renderHost(fake);
    act(() =>
      fake.serverEmit(
        'gameState',
        baseState({
          phase: 'question',
          playerCount: 1,
          endsAt: Date.now() + 20_000,
          players: [
            {
              id: 'p1',
              nickname: 'Alice',
              score: 0,
              connected: false,
              hasAnswered: false,
            },
          ],
          currentQuestion: {
            id: 'q1',
            number: 1,
            total: 3,
            category: 'Science',
            difficulty: 'easy',
            text: 'Capital of Japan?',
            options: ['Tokyo', 'Seoul', 'Beijing', 'Bangkok'],
          },
        }),
      ),
    );

    expect(await screen.findByText('Alice disconnected')).toBeInTheDocument();
  });

  it('disables Start until at least one player has joined', () => {
    fake.respondToAck('hostJoin', () => ({
      ok: true,
      state: baseState({ players: [], playerCount: 0 }),
      categories: [{ name: 'Science', count: 5 }],
    }));
    renderHost(fake);

    expect(screen.getByTestId('start-button')).toBeDisabled();
  });

  it('shows who picked each answer on reveal', () => {
    renderHost(fake);
    act(() =>
      fake.serverEmit(
        'gameState',
        baseState({
          phase: 'reveal',
          playerCount: 4,
          revealedCorrectIndex: 0,
          optionVoters: [['Alice', 'Bob', 'Carol'], ['Dave'], [], []],
          currentQuestion: {
            id: 'q1',
            number: 1,
            total: 3,
            category: 'Science',
            difficulty: 'easy',
            text: 'Capital of Japan?',
            options: ['Tokyo', 'Seoul', 'Beijing', 'Bangkok'],
          },
        }),
      ),
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(screen.getByText('Dave')).toBeInTheDocument();
  });

  it('shows only vote counts when votes are anonymous', () => {
    renderHost(fake);
    act(() =>
      fake.serverEmit(
        'gameState',
        baseState({
          phase: 'reveal',
          playerCount: 3,
          revealedCorrectIndex: 0,
          optionCounts: [2, 1, 0, 0],
          optionVoters: null,
          currentQuestion: {
            id: 'q1',
            number: 1,
            total: 3,
            category: 'Science',
            difficulty: 'easy',
            text: 'Capital of Japan?',
            options: ['Tokyo', 'Seoul', 'Beijing', 'Bangkok'],
          },
        }),
      ),
    );

    expect(screen.getByText('2 votes')).toBeInTheDocument();
    expect(screen.getByText('1 vote')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('spins to the next category before the question', () => {
    renderHost(fake);
    act(() =>
      fake.serverEmit(
        'gameState',
        baseState({
          phase: 'intro',
          endsAt: Date.now() + 2000,
          upcoming: { category: 'Music', number: 2, total: 10 },
        }),
      ),
    );

    expect(screen.getByText('Question 2 of 10')).toBeInTheDocument();
    expect(screen.getByText('Next category: Music')).toBeInTheDocument();
  });

  it('caps the visible voters and shows an overflow count', () => {
    renderHost(fake);
    act(() =>
      fake.serverEmit(
        'gameState',
        baseState({
          phase: 'reveal',
          playerCount: 8,
          revealedCorrectIndex: 0,
          optionVoters: [['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], [], [], []],
          currentQuestion: {
            id: 'q1',
            number: 1,
            total: 3,
            category: 'Science',
            difficulty: 'easy',
            text: 'Capital of Japan?',
            options: ['Tokyo', 'Seoul', 'Beijing', 'Bangkok'],
          },
        }),
      ),
    );

    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('advances the game with the host control buttons during a question', async () => {
    const user = userEvent.setup();
    renderHost(fake);
    act(() =>
      fake.serverEmit(
        'gameState',
        baseState({
          phase: 'question',
          playerCount: 3,
          answeredCount: 1,
          endsAt: Date.now() + 20_000,
          currentQuestion: {
            id: 'q1',
            number: 1,
            total: 3,
            category: 'Science',
            difficulty: 'easy',
            text: 'Capital of Japan?',
            options: ['Tokyo', 'Seoul', 'Beijing', 'Bangkok'],
          },
        }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Reveal answers' }));
    expect(fake.emittedArgs('hostNext')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'End game' }));
    expect(fake.emittedArgs('hostEnd')).toHaveLength(1);
  });

  it('renders the question, options, and answered count', () => {
    renderHost(fake);
    act(() =>
      fake.serverEmit(
        'gameState',
        baseState({
          phase: 'question',
          playerCount: 3,
          answeredCount: 2,
          endsAt: Date.now() + 20_000,
          currentQuestion: {
            id: 'q1',
            number: 1,
            total: 3,
            category: 'Science',
            difficulty: 'easy',
            text: 'Capital of Japan?',
            options: ['Tokyo', 'Seoul', 'Beijing', 'Bangkok'],
          },
        }),
      ),
    );

    expect(screen.getByText('Capital of Japan?')).toBeInTheDocument();
    expect(screen.getByText('Tokyo')).toBeInTheDocument();
    expect(screen.getByText('2/3 answered')).toBeInTheDocument();
    expect(screen.getByText(/Science/)).toBeInTheDocument();
  });

  it('renders a question image when one is provided', () => {
    renderHost(fake);
    act(() =>
      fake.serverEmit(
        'gameState',
        baseState({
          phase: 'question',
          endsAt: Date.now() + 20_000,
          currentQuestion: {
            id: 'flag1',
            number: 1,
            total: 3,
            category: 'Flags',
            difficulty: 'easy',
            text: "Which country's flag is this?",
            options: ['Norway', 'Denmark', 'Iceland', 'Finland'],
            imageUrl: 'https://flagcdn.com/w320/no.png',
          },
        }),
      ),
    );

    const image = screen.getByRole('img');
    expect(image).toHaveAttribute('src', 'https://flagcdn.com/w320/no.png');
  });

  it('offers to replay the tune on a name-that-tune question', async () => {
    renderHost(fake);
    const question = {
      id: 'tune1',
      number: 1,
      total: 3,
      category: 'Music',
      difficulty: 'easy' as const,
      text: 'Name that tune! 🎵',
      options: ['Ode to Joy', 'Für Elise', 'Canon in D', 'Swan Lake'],
      melody: { bpm: 120, notes: 'E4:1 E4:1 F4:1 G4:1' },
    };
    act(() =>
      fake.serverEmit(
        'gameState',
        baseState({
          phase: 'question',
          endsAt: Date.now() + 20_000,
          currentQuestion: question,
        }),
      ),
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Play the tune again' }),
    );

    act(() =>
      fake.serverEmit(
        'gameState',
        baseState({
          phase: 'reveal',
          currentQuestion: question,
          revealedCorrectIndex: 0,
        }),
      ),
    );
    expect(
      screen.queryByRole('button', { name: 'Play the tune again' }),
    ).toBeNull();
  });

  it('animates the leaderboard from the previous standings to the final scores', () => {
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
        'Date',
      ],
    });
    try {
      renderHost(fake);
      act(() =>
        fake.serverEmit(
          'gameState',
          baseState({
            phase: 'leaderboard',
            leaderboard: [
              {
                playerId: 'p1',
                nickname: 'Alice',
                score: 1500,
                rank: 1,
                lastPoints: 750,
                streak: 0,
              },
              {
                playerId: 'p2',
                nickname: 'Bob',
                score: 500,
                rank: 2,
                lastPoints: 0,
                streak: 0,
              },
            ],
          }),
        ),
      );

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('750')).toBeInTheDocument();
      expect(screen.queryByText('+750')).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByText('1500')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('+750')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers Play again and New game on the final screen', async () => {
    const user = userEvent.setup();
    renderHost(fake);
    act(() =>
      fake.serverEmit(
        'gameState',
        baseState({
          phase: 'ended',
          leaderboard: [
            {
              playerId: 'p1',
              nickname: 'Alice',
              score: 900,
              rank: 1,
              lastPoints: 0,
              streak: 0,
            },
          ],
        }),
      ),
    );

    expect(screen.getByRole('list', { name: 'Podium' })).toHaveTextContent(
      'Alice',
    );
    expect(localStorage.getItem('quiz.hostCode')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Play again' }));
    expect(fake.emittedArgs('hostPlayAgain')).toHaveLength(1);
    expect(fake.emittedArgs('hostJoin')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'New game' }));
    expect(fake.emittedArgs('hostJoin')).toHaveLength(2);
  });

  it('remembers the room code again when the game goes back to the lobby', () => {
    renderHost(fake);
    act(() => fake.serverEmit('gameState', baseState({ phase: 'ended' })));
    expect(localStorage.getItem('quiz.hostCode')).toBeNull();

    act(() => fake.serverEmit('gameState', baseState({ phase: 'lobby' })));
    expect(localStorage.getItem('quiz.hostCode')).toBe('WXYZ');
  });

  it('puts the top three on the podium and splits a long rest into two columns', () => {
    renderHost(fake);
    const leaderboard = Array.from({ length: 8 }, (_, index) => ({
      playerId: `p${index + 1}`,
      nickname: `Player ${index + 1}`,
      score: 990 - index * 10,
      rank: index + 1,
      lastPoints: 0,
      streak: 0,
    }));
    act(() =>
      fake.serverEmit('gameState', baseState({ phase: 'ended', leaderboard })),
    );

    const podium = screen.getByRole('list', { name: 'Podium' });
    expect(podium).toHaveTextContent('Player 1');
    expect(podium).toHaveTextContent('Player 3');
    expect(podium).not.toHaveTextContent('Player 4');
    const rest = screen.getByText('Player 8').closest('ol');
    expect(rest).toHaveClass('leaderboard--two-columns');
    expect(rest).toHaveTextContent('Player 4');
  });

  it('hands out end-of-game awards from the players stats', () => {
    renderHost(fake);
    const stats = (overrides: object) => ({
      correct: 0,
      incorrect: 0,
      unanswered: 0,
      averageResponseMs: null,
      fastestCorrectMs: null,
      bestStreak: 0,
      ...overrides,
    });
    act(() =>
      fake.serverEmit(
        'gameState',
        baseState({
          phase: 'ended',
          leaderboard: [
            {
              playerId: 'p1',
              nickname: 'Alice',
              score: 990,
              rank: 1,
              lastPoints: 0,
              streak: 0,
              stats: stats({
                correct: 5,
                fastestCorrectMs: 2400,
                bestStreak: 2,
              }),
            },
            {
              playerId: 'p2',
              nickname: 'Bob',
              score: 800,
              rank: 2,
              lastPoints: 0,
              streak: 0,
              stats: stats({
                correct: 4,
                fastestCorrectMs: 900,
                bestStreak: 4,
              }),
            },
          ],
        }),
      ),
    );

    expect(screen.getByText('Fastest finger').closest('li')).toHaveTextContent(
      'Bob 0.9s',
    );
    expect(screen.getByText('Sharpshooter').closest('li')).toHaveTextContent(
      'Alice 5 correct',
    );
    expect(screen.getByText('Hot streak').closest('li')).toHaveTextContent(
      'Bob 4 in a row',
    );
  });

  it('shows a streak badge from three correct answers in a row', async () => {
    renderHost(fake);
    act(() =>
      fake.serverEmit(
        'gameState',
        baseState({
          phase: 'leaderboard',
          leaderboard: [
            {
              playerId: 'p1',
              nickname: 'Alice',
              score: 990,
              rank: 1,
              lastPoints: 0,
              streak: 3,
            },
            {
              playerId: 'p2',
              nickname: 'Bob',
              score: 500,
              rank: 2,
              lastPoints: 0,
              streak: 2,
            },
          ],
        }),
      ),
    );

    expect(
      await screen.findByText('🔥3', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('🔥2')).not.toBeInTheDocument();
  });

  it('floats emoji reactions from players across the screen', () => {
    renderHost(fake);
    act(() => fake.serverEmit('reaction', { nickname: 'Alice', emoji: '😂' }));

    expect(screen.getByText('😂')).toBeInTheDocument();
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(1);
  });
});
