import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublicGameState } from '@quiz/shared';
import { HostPage } from './HostPage.js';
import { SocketProvider } from '../SocketContext.js';
import { FakeSocket } from '../test/fakeSocket.js';

function baseState(overrides: Partial<PublicGameState> = {}): PublicGameState {
  return {
    code: 'WXYZ',
    phase: 'lobby',
    settings: {
      questionCount: 3,
      secondsPerQuestion: 20,
      category: null,
      difficulty: null,
      autoAdvance: false,
      revealSeconds: 5,
      leaderboardSeconds: 8,
    },
    players: [],
    currentQuestion: null,
    revealedCorrectIndex: null,
    endsAt: null,
    answeredCount: 0,
    playerCount: 0,
    optionCounts: null,
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

  it('disables Start until at least one player has joined', () => {
    fake.respondToAck('hostJoin', () => ({
      ok: true,
      state: baseState({ players: [], playerCount: 0 }),
      categories: [{ name: 'Science', count: 5 }],
    }));
    renderHost(fake);

    expect(screen.getByTestId('start-button')).toBeDisabled();
  });

  it('shows the answer distribution on reveal', () => {
    renderHost(fake);
    act(() =>
      fake.serverEmit(
        'gameState',
        baseState({
          phase: 'reveal',
          playerCount: 4,
          revealedCorrectIndex: 0,
          optionCounts: [3, 1, 0, 0],
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

    expect(screen.getByText('3 · 75%')).toBeInTheDocument();
    expect(screen.getByText('1 · 25%')).toBeInTheDocument();
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
    expect(screen.getByText('Science')).toBeInTheDocument();
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
              },
              {
                playerId: 'p2',
                nickname: 'Bob',
                score: 500,
                rank: 2,
                lastPoints: 0,
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
});
