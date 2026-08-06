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
    optionCounts: null,
    leaderboard: [],
    ...overrides,
  };
}

function questionState(
  options: string[],
  id = 'q1',
  number = 1,
): PublicGameState {
  return baseState({
    phase: 'question',
    currentQuestion: {
      id,
      number,
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

function clearNicknameCookie() {
  document.cookie = 'quiz.nickname=; max-age=0; path=/';
}

describe('PlayerPage join flow', () => {
  let fake: FakeSocket;

  beforeEach(() => {
    localStorage.clear();
    clearNicknameCookie();
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

  it('shows the question category as a chip', async () => {
    act(() => fake.serverEmit('gameState', questionState(['A', 'B', 'C', 'D'])));
    expect(await screen.findByText('Science')).toBeInTheDocument();
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

  it('unlocks answering on a new question even without a questionStarted event', async () => {
    act(() => fake.serverEmit('gameState', questionState(['A', 'B', 'C', 'D'], 'q1')));
    await userEvent.click(await screen.findByRole('button', { name: /A/ }));
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
    }

    act(() =>
      fake.serverEmit('gameState', questionState(['A', 'B', 'C', 'D'], 'q2', 2)),
    );

    const buttons = await screen.findAllByRole('button');
    for (const button of buttons) {
      expect(button).not.toBeDisabled();
    }

    await userEvent.click(buttons[1]);
    expect(fake.emittedArgs('submitAnswer').at(-1)?.[0]).toEqual({
      optionIndex: 1,
    });
  });

  it('does not show a banner for a benign answer rejection', async () => {
    act(() => fake.serverEmit('gameState', questionState(['A', 'B', 'C', 'D'])));
    act(() => fake.serverEmit('errorMessage', 'Not accepting answers right now.'));

    expect(
      screen.queryByText('Not accepting answers right now.'),
    ).not.toBeInTheDocument();
  });

  it('clears a lingering error banner when the phase changes', async () => {
    act(() => fake.serverEmit('errorMessage', 'You are not in a game.'));
    expect(
      await screen.findByText('You are not in a game.'),
    ).toBeInTheDocument();

    act(() => fake.serverEmit('gameState', questionState(['A', 'B', 'C', 'D'])));

    await waitFor(() =>
      expect(
        screen.queryByText('You are not in a game.'),
      ).not.toBeInTheDocument(),
    );
  });

  it('shows a get-ready countdown before the first question', async () => {
    act(() =>
      fake.serverEmit(
        'gameState',
        baseState({ phase: 'countdown', endsAt: Date.now() + 5_000 }),
      ),
    );

    expect(await screen.findByText(/Get ready/i)).toBeInTheDocument();
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

  it('reconnects and rejoins when the tab becomes visible after a drop', async () => {
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

    fake.connected = false;
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    expect(fake.connected).toBe(true);
    expect(fake.emittedArgs('playerRejoin')[0]?.[0]).toEqual({
      code: 'WXYZ',
      playerId: 'p1',
    });
  });

  it('does not reconnect on visibility when the socket is still connected', async () => {
    fake.respondToAck('playerJoin', () => ({
      ok: true,
      playerId: 'p1',
      state: baseState(),
    }));

    renderPlayer(fake, '/play?code=WXYZ');
    await userEvent.type(screen.getByLabelText('Nickname'), 'Alice');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    await screen.findByText(/You're in/i);

    fake.connected = true;
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    expect(fake.emittedArgs('playerRejoin')).toHaveLength(0);
  });
});

describe('PlayerPage nickname cookie', () => {
  let fake: FakeSocket;

  beforeEach(() => {
    localStorage.clear();
    clearNicknameCookie();
    fake = new FakeSocket();
  });

  it('prefills the nickname from the cookie when there is no stored session', () => {
    document.cookie = 'quiz.nickname=Charlie; path=/';
    renderPlayer(fake, '/play?code=WXYZ');

    const nicknameInput = screen.getByLabelText('Nickname') as HTMLInputElement;
    expect(nicknameInput.value).toBe('Charlie');
  });

  it('remembers the nickname in a cookie after a successful join', async () => {
    fake.respondToAck('playerJoin', () => ({
      ok: true,
      playerId: 'p1',
      state: baseState(),
    }));
    renderPlayer(fake, '/play?code=WXYZ');

    await userEvent.type(screen.getByLabelText('Nickname'), 'Dana');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    await screen.findByText(/You're in/i);

    expect(document.cookie).toContain('quiz.nickname=Dana');
  });
});
