import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  GameSettings,
  InterServerEvents,
  Question,
  ServerToClientEvents,
  SocketData,
} from '@quiz/shared';
import { GameManager } from './GameManager.js';
import { generateGameCode } from './code.js';
import { listCategories } from '../questions/loader.js';

type QuizServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
type QuizSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Bridges Socket.IO connections to a single in-memory GameManager, broadcasting
 * state to a room named after the game code and driving the question countdown.
 */
export class GameService {
  private game: GameManager | null = null;
  private readonly playerSockets = new Map<string, string>();
  private revealTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly io: QuizServer,
    private readonly questionPool: Question[],
  ) {}

  register(socket: QuizSocket): void {
    socket.on('hostJoin', (ack) => {
      const game = this.ensureGame();
      socket.data.role = 'host';
      socket.data.code = game.code;
      void socket.join(game.code);
      ack({
        ok: true,
        state: game.getPublicState(),
        categories: listCategories(this.questionPool),
      });
    });

    socket.on('playerJoin', ({ code, nickname }, ack) => {
      const game = this.game;
      if (!game || game.code !== normalizeCode(code)) {
        ack({ ok: false, error: 'Game not found.' });
        return;
      }
      try {
        const playerId = game.addPlayer(nickname);
        socket.data.role = 'player';
        socket.data.code = game.code;
        socket.data.playerId = playerId;
        this.playerSockets.set(playerId, socket.id);
        void socket.join(game.code);
        ack({ ok: true, playerId, state: game.getPublicState() });
        this.broadcastState();
      } catch (error) {
        ack({ ok: false, error: toMessage(error) });
      }
    });

    socket.on('adminJoin', ({ code }, ack) => {
      const game = this.game;
      if (!game || game.code !== normalizeCode(code)) {
        ack({ ok: false, error: 'Game not found.' });
        return;
      }
      socket.data.role = 'admin';
      socket.data.code = game.code;
      void socket.join(game.code);
      ack({
        ok: true,
        state: game.getPublicState(),
        categories: listCategories(this.questionPool),
      });
    });

    socket.on('adminStart', (settings: GameSettings) => {
      const game = this.requireAdminGame(socket);
      if (!game) return;
      try {
        game.start(settings);
      } catch (error) {
        socket.emit('errorMessage', toMessage(error));
        return;
      }
      this.onQuestionBegan();
    });

    socket.on('adminNext', () => {
      const game = this.requireAdminGame(socket);
      if (!game) return;
      this.clearTimer();
      const before = game.phase;
      game.advance();
      const after = game.phase;
      if (before === 'question' && after === 'reveal') {
        this.onReveal();
      } else if (after === 'question') {
        this.onQuestionBegan();
      } else {
        this.broadcastState();
      }
    });

    socket.on('adminEnd', () => {
      const game = this.requireAdminGame(socket);
      if (!game) return;
      this.clearTimer();
      game.end();
      this.broadcastState();
    });

    socket.on('submitAnswer', ({ optionIndex }) => {
      const game = this.game;
      const playerId = socket.data.playerId;
      if (!game || !playerId) {
        socket.emit('errorMessage', 'You are not in a game.');
        return;
      }
      try {
        const result = game.submitAnswer(playerId, optionIndex);
        if (!result.accepted) {
          socket.emit('errorMessage', result.reason ?? 'Answer not accepted.');
          return;
        }
      } catch (error) {
        socket.emit('errorMessage', toMessage(error));
        return;
      }
      this.broadcastState();
      if (game.allConnectedAnswered()) {
        this.revealNow();
      }
    });

    socket.on('disconnect', () => {
      const { playerId } = socket.data;
      if (playerId && this.game) {
        this.game.setConnected(playerId, false);
        this.playerSockets.delete(playerId);
        this.broadcastState();
        // If the departing player was the last one we were waiting on, don't
        // stall the round on the timer — reveal as soon as everyone still
        // connected has answered.
        if (
          this.game.phase === 'question' &&
          this.game.allConnectedAnswered()
        ) {
          this.revealNow();
        }
      }
    });
  }

  /** Stop any pending timer (used on shutdown). */
  dispose(): void {
    this.clearTimer();
  }

  // --- Internals -------------------------------------------------------------

  private ensureGame(): GameManager {
    if (!this.game || this.game.phase === 'ended') {
      this.clearTimer();
      this.playerSockets.clear();
      this.game = new GameManager({
        code: generateGameCode(),
        questionPool: this.questionPool,
      });
    }
    return this.game;
  }

  private requireAdminGame(socket: QuizSocket): GameManager | null {
    if (socket.data.role !== 'admin' || !this.game) {
      socket.emit('errorMessage', 'You are not the admin of a game.');
      return null;
    }
    return this.game;
  }

  private onQuestionBegan(): void {
    const game = this.game;
    if (!game) return;
    const state = game.getPublicState();
    this.broadcastState(state);
    if (state.currentQuestion && state.endsAt !== null) {
      this.io
        .to(game.code)
        .emit('questionStarted', state.currentQuestion, state.endsAt);
      this.scheduleReveal(state.endsAt);
    }
  }

  private revealNow(): void {
    if (this.game?.phase !== 'question') return;
    this.clearTimer();
    this.game.reveal();
    this.onReveal();
  }

  private onReveal(): void {
    const game = this.game;
    if (!game) return;
    for (const [playerId, socketId] of this.playerSockets) {
      if (game.hasPlayer(playerId)) {
        this.io.to(socketId).emit('answerResult', game.getAnswerResult(playerId));
      }
    }
    this.broadcastState();
  }

  private scheduleReveal(endsAt: number): void {
    this.clearTimer();
    const delay = Math.max(0, endsAt - Date.now());
    this.revealTimer = setTimeout(() => this.revealNow(), delay);
  }

  private clearTimer(): void {
    if (this.revealTimer) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }
  }

  private broadcastState(state = this.game?.getPublicState()): void {
    if (this.game && state) {
      this.io.to(this.game.code).emit('gameState', state);
    }
  }
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
