import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { io as createClient, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  GameSettings,
  JoinAck,
  ObserverJoinAck,
  PublicGameState,
  PublicQuestion,
  Question,
  ServerToClientEvents,
} from '@quiz/shared';
import { createGameServer, type GameServerHandles } from '../app.js';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const pool: Question[] = [
  {
    id: 'q1',
    category: 'Science',
    difficulty: 'easy',
    text: 'Q1',
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
  },
  {
    id: 'q2',
    category: 'Science',
    difficulty: 'easy',
    text: 'Q2',
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
  },
];

const settings: GameSettings = {
  questionCount: 2,
  secondsPerQuestion: 30,
  category: null,
  difficulty: null,
  autoAdvance: false,
  revealSeconds: 5,
  leaderboardSeconds: 8,
};

let handles: GameServerHandles;
let port: number;
const clients: ClientSocket[] = [];

beforeEach(async () => {
  handles = createGameServer(pool);
  await new Promise<void>((resolve) => {
    handles.httpServer.listen(0, resolve);
  });
  port = (handles.httpServer.address() as AddressInfo).port;
});

afterEach(async () => {
  for (const client of clients) {
    client.disconnect();
  }
  clients.length = 0;
  handles.service.dispose();
  await new Promise<void>((resolve) => {
    handles.io.close(() => resolve());
  });
});

function connect(): ClientSocket {
  const socket: ClientSocket = createClient(`http://localhost:${port}`, {
    forceNew: true,
    transports: ['websocket'],
  });
  clients.push(socket);
  return socket;
}

function hostJoin(
  socket: ClientSocket,
  code?: string,
): Promise<ObserverJoinAck> {
  return new Promise((resolve) => socket.emit('hostJoin', { code }, resolve));
}

function playerJoin(
  socket: ClientSocket,
  code: string,
  nickname: string,
): Promise<JoinAck> {
  return new Promise((resolve) =>
    socket.emit('playerJoin', { code, nickname }, resolve),
  );
}

function adminJoin(
  socket: ClientSocket,
  code: string,
): Promise<ObserverJoinAck> {
  return new Promise((resolve) => socket.emit('adminJoin', { code }, resolve));
}

function playerRejoin(
  socket: ClientSocket,
  code: string,
  playerId: string,
): Promise<JoinAck> {
  return new Promise((resolve) =>
    socket.emit('playerRejoin', { code, playerId }, resolve),
  );
}

function nextQuestion(
  socket: ClientSocket,
): Promise<[PublicQuestion, number]> {
  return new Promise((resolve) =>
    socket.once('questionStarted', (question, endsAt) =>
      resolve([question, endsAt]),
    ),
  );
}

function waitForState(
  socket: ClientSocket,
  predicate: (state: PublicGameState) => boolean,
): Promise<PublicGameState> {
  return new Promise((resolve) => {
    const handler = (state: PublicGameState) => {
      if (predicate(state)) {
        socket.off('gameState', handler);
        resolve(state);
      }
    };
    socket.on('gameState', handler);
  });
}

describe('GameService integration', () => {
  it('runs a full round: join, start, answer, reveal, leaderboard', async () => {
    const host = connect();
    const hostAck = await hostJoin(host);
    expect(hostAck.ok).toBe(true);
    if (!hostAck.ok) return;
    const code = hostAck.state.code;
    expect(code).toHaveLength(4);
    expect(hostAck.categories.length).toBeGreaterThan(0);

    const player = connect();
    const hostSeesPlayer = waitForState(host, (s) => s.players.length === 1);
    const playerAck = await playerJoin(player, code, 'Alice');
    expect(playerAck.ok).toBe(true);
    const lobbyState = await hostSeesPlayer;
    expect(lobbyState.players[0]?.nickname).toBe('Alice');

    const admin = connect();
    const adminAck = await adminJoin(admin, code);
    expect(adminAck.ok).toBe(true);

    const questionArrives = nextQuestion(player);
    admin.emit('adminStart', settings);
    const [question, endsAt] = await questionArrives;
    expect(question.number).toBe(1);
    expect(question.total).toBe(2);
    expect(endsAt).toBeGreaterThan(Date.now());

    const correctOption = question.options.indexOf('A');
    const answerResult = new Promise<{
      correct: boolean;
      pointsAwarded: number;
    }>((resolve) => player.once('answerResult', resolve));
    player.emit('submitAnswer', { optionIndex: correctOption });
    const result = await answerResult;
    expect(result.correct).toBe(true);
    expect(result.pointsAwarded).toBeGreaterThan(0);

    const leaderboardShown = waitForState(
      host,
      (s) => s.phase === 'leaderboard',
    );
    admin.emit('adminNext');
    const leaderboardState = await leaderboardShown;
    expect(leaderboardState.leaderboard[0]?.nickname).toBe('Alice');
    expect(leaderboardState.leaderboard[0]?.score).toBeGreaterThan(0);
  });

  it('auto-advances from reveal to leaderboard when autoAdvance is enabled', async () => {
    const host = connect();
    const hostAck = await hostJoin(host);
    expect(hostAck.ok).toBe(true);
    if (!hostAck.ok) return;
    const code = hostAck.state.code;

    const player = connect();
    await playerJoin(player, code, 'Alice');
    const admin = connect();
    await adminJoin(admin, code);

    const questionArrives = nextQuestion(player);
    admin.emit('adminStart', {
      ...settings,
      secondsPerQuestion: 120,
      autoAdvance: true,
      revealSeconds: 2,
    });
    await questionArrives;

    const leaderboardShown = waitForState(host, (s) => s.phase === 'leaderboard');
    player.emit('submitAnswer', { optionIndex: 0 });
    const leaderboardState = await leaderboardShown;
    expect(leaderboardState.phase).toBe('leaderboard');
  });

  it('reveals without waiting when the last un-answered player disconnects', async () => {
    const host = connect();
    const hostAck = await hostJoin(host);
    expect(hostAck.ok).toBe(true);
    if (!hostAck.ok) return;
    const code = hostAck.state.code;

    const alice = connect();
    await playerJoin(alice, code, 'Alice');
    const bob = connect();
    await playerJoin(bob, code, 'Bob');

    const admin = connect();
    await adminJoin(admin, code);

    const questionArrives = nextQuestion(alice);
    admin.emit('adminStart', { ...settings, secondsPerQuestion: 120 });
    const [question] = await questionArrives;
    const correctOption = question.options.indexOf('A');

    const revealShown = waitForState(host, (s) => s.phase === 'reveal');
    alice.emit('submitAnswer', { optionIndex: correctOption });
    bob.disconnect();

    const revealState = await revealShown;
    expect(revealState.phase).toBe('reveal');
    expect(revealState.revealedCorrectIndex).toBe(correctOption);
  });

  it('gives each host its own room, and rejoins an existing room by code', async () => {
    const host1 = connect();
    const ack1 = await hostJoin(host1);
    const host2 = connect();
    const ack2 = await hostJoin(host2);
    expect(ack1.ok && ack2.ok).toBe(true);
    if (!ack1.ok || !ack2.ok) return;

    expect(ack1.state.code).not.toBe(ack2.state.code);

    const player = connect();
    await playerJoin(player, ack1.state.code, 'Alice');
    const rejoin = connect();
    const rejoinAck = await hostJoin(rejoin, ack1.state.code);
    expect(rejoinAck.ok).toBe(true);
    if (!rejoinAck.ok) return;
    expect(rejoinAck.state.code).toBe(ack1.state.code);
    expect(rejoinAck.state.players.map((p) => p.nickname)).toEqual(['Alice']);
  });

  it('creates a fresh room when rejoining a code that no longer exists', async () => {
    const host = connect();
    const ack = await hostJoin(host, 'ZZZZ');
    expect(ack.ok).toBe(true);
    if (!ack.ok) return;
    expect(ack.state.code).not.toBe('ZZZZ');
    expect(ack.state.phase).toBe('lobby');
  });

  it('rejects joining with an unknown code', async () => {
    const host = connect();
    await hostJoin(host);
    const player = connect();
    const ack = await playerJoin(player, 'ZZZZ', 'Bob');
    expect(ack.ok).toBe(false);
    if (!ack.ok) {
      expect(ack.error).toMatch(/not found/i);
    }
  });

  it('lets a dropped player rejoin on a new socket and keep answering', async () => {
    const host = connect();
    const hostAck = await hostJoin(host);
    expect(hostAck.ok).toBe(true);
    if (!hostAck.ok) return;
    const code = hostAck.state.code;

    const player = connect();
    const joinAck = await playerJoin(player, code, 'Alice');
    expect(joinAck.ok).toBe(true);
    if (!joinAck.ok) return;
    const { playerId } = joinAck;

    const admin = connect();
    await adminJoin(admin, code);

    const questionArrives = nextQuestion(host);
    admin.emit('adminStart', { ...settings, secondsPerQuestion: 120 });
    const [question] = await questionArrives;
    const correctOption = question.options.indexOf('A');

    const seenOffline = waitForState(
      host,
      (s) => s.players[0]?.connected === false,
    );
    player.disconnect();
    await seenOffline;

    const revived = connect();
    const rejoinAck = await playerRejoin(revived, code, playerId);
    expect(rejoinAck.ok).toBe(true);
    if (!rejoinAck.ok) return;
    expect(rejoinAck.playerId).toBe(playerId);
    expect(rejoinAck.state.players[0]?.connected).toBe(true);

    const answered = new Promise<{ correct: boolean }>((resolve) =>
      revived.once('answerResult', resolve),
    );
    revived.emit('submitAnswer', { optionIndex: correctOption });
    const result = await answered;
    expect(result.correct).toBe(true);
  });

  it('rejects a rejoin for an unknown player id', async () => {
    const host = connect();
    const hostAck = await hostJoin(host);
    expect(hostAck.ok).toBe(true);
    if (!hostAck.ok) return;

    const player = connect();
    const ack = await playerRejoin(player, hostAck.state.code, 'not-a-real-id');
    expect(ack.ok).toBe(false);
    if (!ack.ok) {
      expect(ack.error).toMatch(/session/i);
    }
  });

  it('reports the game code on the health endpoint server', async () => {
    const response = await fetch(`http://localhost:${port}/healthz`);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe('ok');
  });
});
