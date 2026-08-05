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

function hostJoin(socket: ClientSocket): Promise<ObserverJoinAck> {
  return new Promise((resolve) => socket.emit('hostJoin', resolve));
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

    // Player joins and shows up on the host screen.
    const player = connect();
    const hostSeesPlayer = waitForState(host, (s) => s.players.length === 1);
    const playerAck = await playerJoin(player, code, 'Alice');
    expect(playerAck.ok).toBe(true);
    const lobbyState = await hostSeesPlayer;
    expect(lobbyState.players[0]?.nickname).toBe('Alice');

    // Admin joins and starts the game.
    const admin = connect();
    const adminAck = await adminJoin(admin, code);
    expect(adminAck.ok).toBe(true);

    const questionArrives = nextQuestion(player);
    admin.emit('adminStart', settings);
    const [question, endsAt] = await questionArrives;
    expect(question.number).toBe(1);
    expect(question.total).toBe(2);
    expect(endsAt).toBeGreaterThan(Date.now());

    // The single player answers correctly, which auto-reveals.
    const answerResult = new Promise<{
      correct: boolean;
      pointsAwarded: number;
    }>((resolve) => player.once('answerResult', resolve));
    player.emit('submitAnswer', { optionIndex: 0 });
    const result = await answerResult;
    expect(result.correct).toBe(true);
    expect(result.pointsAwarded).toBeGreaterThan(0);

    // Admin advances to the leaderboard.
    const leaderboardShown = waitForState(
      host,
      (s) => s.phase === 'leaderboard',
    );
    admin.emit('adminNext');
    const leaderboardState = await leaderboardShown;
    expect(leaderboardState.leaderboard[0]?.nickname).toBe('Alice');
    expect(leaderboardState.leaderboard[0]?.score).toBeGreaterThan(0);
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
    // A long timer so the round can only end via the disconnect path, not timeout.
    admin.emit('adminStart', { ...settings, secondsPerQuestion: 120 });
    await questionArrives;

    // Alice answers; Bob never does, then leaves — the round should reveal.
    const revealShown = waitForState(host, (s) => s.phase === 'reveal');
    alice.emit('submitAnswer', { optionIndex: 0 });
    bob.disconnect();

    const revealState = await revealShown;
    expect(revealState.phase).toBe('reveal');
    expect(revealState.revealedCorrectIndex).toBe(0);
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

  it('reports the game code on the health endpoint server', async () => {
    const response = await fetch(`http://localhost:${port}/healthz`);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe('ok');
  });
});
