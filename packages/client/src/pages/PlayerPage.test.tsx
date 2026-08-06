import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { PublicGameState } from '@quiz/shared';
import { PlayerPage } from './PlayerPage.js';
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
    playerCount: 1,
    leaderboard: [],
    ...overrides,
  };
}

function questionState(options: string[]): PublicGameState {
  return baseState({
    phase: 'question',
    currentQuestion: {
      id: 'q1',
      number: 1,
      total: 3,
      category: 'Science',
      difficulty: 'easy',
      text: 'What is the answer?',
      options,
    },
    endsAt: Date.now() + 20_000,
  });
}

function renderPlayer(fake: FakeSocket, entry = '/play') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <SocketProvider socket={fake.asSocket()}>
        <PlayerPage />
      </SocketProvider>
    </MemoryRouter>,
  );
}

describe('PlayerPage join flow', () => {
  let fake: FakeSocket;

  beforeEach(() => {
    localStorage.clear();
    fake = new FakeSocket();
  });

  it('prefills the code from the URL and joins successfully', async () => {
    fake.respondToAck('playerJoin', () => ({
      ok: true,
      playerId: 'p1',
      state: baseState(),
    }));
    renderPlayer(fake, '/play?code=wxyz');

    const codeInput = screen.getByLabelText('Game code') as HTMLInputElement;
    expect(codeInput.value).toBe('WXYZ');

    await userEvent.type(screen.getByLabelText('Nickname'), 'Alice');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(fake.emittedArgs('playerJoin')[0]?.[0]).toEqual({
      code: 'WXYZ',
      nickname: 'Alice',
    });
    expect(await screen.findByText(/You're in/i)).toBeInTheDocument();
  });

  it('shows an error when the join is rejected', async () => {
    fake.respondToAck('playerJoin', () => ({
      ok: false,
      error: 'Game not found.',
    }));
    renderPlayer(fake, '/play?code=ZZZZ');

    await userEvent.type(screen.getByLabelText('Nickname'), 'Bob');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(await screen.findByText('Game not found.')).toBeInTheDocument();
  });

  it('requires a nickname before joining', async () => {
    renderPlayer(fake, '/play?code=WXYZ');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(
      screen.getByText(/Enter a game code and a nickname/i),
    ).toBeInTheDocument();
    expect(fake.emittedArgs('playerJoin')).toHaveLength(0);
  });
});

describe('PlayerPage answering', () => {
  let fake: FakeSocket;

  beforeEach(async () => {
    localStorage.clear();
    fake = new FakeSocket();
    fake.respondToAck('playerJoin', () => ({
      ok: true,
      playerId: 'p1',
      state: baseState(),
    }));
    renderPlayer(fake, '/play?code=WXYZ');
    await userEvent.type(screen.getByLabelText('Nickname'), 'Alice');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    await screen.findByText(/You're in/i);
  });

  it('renders one button per option for a four-option question', async () => {
    act(() => fake.serverEmit('gameState', questionState(['A', 'B', 'C', 'D'])));
    await waitFor(() =>
      expect(screen.getAllByRole('button')).toHaveLength(4),
    );
  });

  it('renders two buttons for a true/false question', async () => {
    act(() => fake.serverEmit('gameState', questionState(['True', 'False'])));
    await waitFor(() =>
      expect(screen.getAllByRole('button')).toHaveLength(2),
    );
  });

  it('locks the buttons after an answer is submitted', async () => {
    act(() => fake.serverEmit('gameState', questionState(['A', 'B', 'C', 'D'])));
    const first = await screen.findByRole('button', { name: /A/ });
    await userEvent.click(first);

    expect(fake.emittedArgs('submitAnswer')[0]?.[0]).toEqual({
      optionIndex: 0,
    });
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
    }
  });

  it('shows placement and stats when the game ends', async () => {
    act(() =>
      fake.serverEmit(
        'gameState',
        baseState({
          phase: 'ended',
          leaderboard: [
            {
              playerId: 'p1',
              nickname: 'Alice',
              score: 2400,
              rank: 1,
              lastPoints: 0,
              stats: {
                correct: 3,
                incorrect: 1,
                unanswered: 1,
                averageResponseMs: 4200,
                fastestCorrectMs: 1500,
              },
            },
          ],
        }),
      ),
    );

    expect(await screen.findByText(/1st place/i)).toBeInTheDocument();
    expect(screen.getByText('2400')).toBeInTheDocument();
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText('4.2s')).toBeInTheDocument();
    expect(screen.getByText('1.5s')).toBeInTheDocument();
  });
});

describe('PlayerPage reconnection', () => {
  let fake: FakeSocket;

  beforeEach(() => {
    localStorage.clear();
    fake = new FakeSocket();
  });

  it('auto-rejoins from a stored session on mount, skipping the form', async () => {
    localStorage.setItem(
      'quiz.playerSession',
      JSON.stringify({ code: 'WXYZ', playerId: 'p1', nickname: 'Alice' }),
    );
    fake.respondToAck('playerRejoin', () => ({
      ok: true,
      playerId: 'p1',
      state: baseState({ playerCount: 1 }),
    }));

    renderPlayer(fake, '/play');

    expect(await screen.findByText(/You're in/i)).toBeInTheDocument();
    expect(fake.emittedArgs('playerRejoin')[0]?.[0]).toEqual({
      code: 'WXYZ',
      playerId: 'p1',
    });
  });

  it('falls back to the join form when the stored session has expired', async () => {
    localStorage.setItem(
      'quiz.playerSession',
      JSON.stringify({ code: 'WXYZ', playerId: 'gone', nickname: 'Alice' }),
    );
    fake.respondToAck('playerRejoin', () => ({
      ok: false,
      error: 'Your game session has expired.',
    }));

    renderPlayer(fake, '/play');

    expect(await screen.findByRole('button', { name: 'Join' })).toBeVisible();
    expect(localStorage.getItem('quiz.playerSession')).toBeNull();
  });

  it('re-attaches by emitting playerRejoin when the socket reconnects', async () => {
    fake.respondToAck('playerJoin', () => ({
      ok: true,
      playerId: 'p1',
      state: baseState(),
    }));
    fake.respondToAck('playerRejoin', () => ({
      ok: true,
      playerId: 'p1',
      state: baseState(),
    }));

    renderPlayer(fake, '/play?code=WXYZ');
    await userEvent.type(screen.getByLabelText('Nickname'), 'Alice');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    await screen.findByText(/You're in/i);

    act(() => fake.serverEmit('connect'));

    expect(fake.emittedArgs('playerRejoin')[0]?.[0]).toEqual({
      code: 'WXYZ',
      playerId: 'p1',
    });
  });
});
