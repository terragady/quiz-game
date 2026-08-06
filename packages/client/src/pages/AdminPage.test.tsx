import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { PublicGameState } from '@quiz/shared';
import { AdminPage } from './AdminPage.js';
import { SocketProvider } from '../SocketContext.js';
import { FakeSocket } from '../test/fakeSocket.js';

function baseState(overrides: Partial<PublicGameState> = {}): PublicGameState {
  return {
    code: 'WXYZ',
    phase: 'lobby',
    settings: {
      questionCount: 10,
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
    leaderboard: [],
    ...overrides,
  };
}

function renderAdmin(fake: FakeSocket, entry = '/admin') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <SocketProvider socket={fake.asSocket()}>
        <AdminPage />
      </SocketProvider>
    </MemoryRouter>,
  );
}

async function connect(fake: FakeSocket) {
  fake.respondToAck('adminJoin', () => ({
    ok: true,
    state: baseState(),
    categories: [{ name: 'Science', count: 5 }],
  }));
  renderAdmin(fake, '/admin?code=WXYZ');
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
  await screen.findByTestId('start-button');
}

describe('AdminPage', () => {
  let fake: FakeSocket;

  beforeEach(() => {
    fake = new FakeSocket();
  });

  it('connects with the prefilled code', async () => {
    await connect(fake);
    expect(fake.emittedArgs('adminJoin')[0]?.[0]).toEqual({ code: 'WXYZ' });
  });

  it('shows an error when the code is rejected', async () => {
    fake.respondToAck('adminJoin', () => ({
      ok: false,
      error: 'Game not found.',
    }));
    renderAdmin(fake, '/admin?code=ZZZZ');
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByText('Game not found.')).toBeInTheDocument();
  });

  it('enables only Start during the lobby', async () => {
    await connect(fake);
    expect(screen.getByTestId('start-button')).toBeEnabled();
    expect(screen.getByTestId('next-button')).toBeDisabled();
    expect(screen.getByTestId('end-button')).toBeDisabled();
  });

  it('enables Next and End once a question is running', async () => {
    await connect(fake);
    act(() =>
      fake.serverEmit(
        'gameState',
        baseState({
          phase: 'question',
          answeredCount: 1,
          playerCount: 2,
          currentQuestion: {
            id: 'q1',
            number: 1,
            total: 3,
            category: 'Science',
            difficulty: 'easy',
            text: 'Q?',
            options: ['A', 'B'],
          },
        }),
      ),
    );

    expect(screen.getByTestId('start-button')).toBeDisabled();
    const next = screen.getByTestId('next-button');
    expect(next).toBeEnabled();
    expect(next).toHaveTextContent('Reveal answers');
    expect(screen.getByTestId('end-button')).toBeEnabled();
  });

  it('emits adminStart with the chosen settings', async () => {
    await connect(fake);
    await userEvent.click(screen.getByTestId('start-button'));
    expect(fake.emittedArgs('adminStart')[0]?.[0]).toMatchObject({
      questionCount: 10,
      secondsPerQuestion: 20,
    });
  });

  it('emits adminNext when advancing', async () => {
    await connect(fake);
    act(() => fake.serverEmit('gameState', baseState({ phase: 'reveal' })));
    await userEvent.click(screen.getByTestId('next-button'));
    expect(fake.emittedArgs('adminNext')).toHaveLength(1);
  });
});
