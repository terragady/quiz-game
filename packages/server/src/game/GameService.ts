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

/** Delay before an empty room is discarded, allowing brief refreshes/reconnects. */
const ROOM_CLEANUP_GRACE_MS = 5 * 60 * 1000;

/**
 * Bridges Socket.IO connections to per-room {@link GameManager} instances,
 * keyed by game code. Each room broadcasts to a Socket.IO room named after its
 * code and drives its own question countdown.
 */
export class GameService {
  private readonly games = new Map<string, GameManager>();
  private readonly phaseTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** playerId -> socketId (player ids are globally unique). */
  private readonly playerSockets = new Map<string, string>();

  constructor(
    private readonly io: QuizServer,
    private readonly questionPool: Question[],
  ) {}

  register(socket: QuizSocket): void {
    socket.on('hostJoin', ({ code }, ack) => {
      const existing = code ? this.games.get(normalizeCode(code)) : undefined;
      const game = existing ?? this.createRoom();
      this.cancelCleanup(game.code);
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
      const game = this.games.get(normalizeCode(code));
      if (!game) {
        ack({ ok: false, error: 'Game not found.' });
        return;
      }
      try {
        const playerId = game.addPlayer(nickname);
        socket.data.role = 'player';
        socket.data.code = game.code;
        socket.data.playerId = playerId;
        this.playerSockets.set(playerId, socket.id);
        this.cancelCleanup(game.code);
        void socket.join(game.code);
        ack({ ok: true, playerId, state: game.getPublicState() });
        this.broadcastState(game.code);
      } catch (error) {
        ack({ ok: false, error: toMessage(error) });
      }
    });

    socket.on('playerRejoin', ({ code, playerId }, ack) => {
      const game = this.games.get(normalizeCode(code));
      if (!game || !game.hasPlayer(playerId)) {
        ack({ ok: false, error: 'Your game session has expired.' });
        return;
      }
      socket.data.role = 'player';
      socket.data.code = game.code;
      socket.data.playerId = playerId;
      this.playerSockets.set(playerId, socket.id);
      game.setConnected(playerId, true);
      this.cancelCleanup(game.code);
      void socket.join(game.code);
      ack({ ok: true, playerId, state: game.getPublicState() });
      this.broadcastState(game.code);
      // If they reconnected mid-reveal, resend their result so the screen matches.
      if (game.phase === 'reveal') {
        socket.emit('answerResult', game.getAnswerResult(playerId));
      }
    });

    socket.on('adminJoin', ({ code }, ack) => {
      const game = this.games.get(normalizeCode(code));
      if (!game) {
        ack({ ok: false, error: 'Game not found.' });
        return;
      }
      socket.data.role = 'admin';
      socket.data.code = game.code;
      this.cancelCleanup(game.code);
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
      this.onQuestionBegan(game.code);
    });

    socket.on('adminNext', () => {
      const game = this.requireAdminGame(socket);
      if (!game) return;
      this.applyAdvance(game.code);
    });

    socket.on('adminEnd', () => {
      const game = this.requireAdminGame(socket);
      if (!game) return;
      this.clearTimer(game.code);
      game.end();
      this.broadcastState(game.code);
    });

    socket.on('submitAnswer', ({ optionIndex }) => {
      const game = this.socketGame(socket);
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
      this.broadcastState(game.code);
      if (game.allConnectedAnswered()) {
        this.revealNow(game.code);
      }
    });

    socket.on('disconnect', () => {
      const { playerId, code } = socket.data;
      const game = code ? this.games.get(code) : undefined;
      // Ignore a stale socket's late disconnect: if the player already
      // reconnected on a newer socket, the map no longer points here.
      if (
        playerId &&
        game &&
        this.playerSockets.get(playerId) === socket.id
      ) {
        game.setConnected(playerId, false);
        this.playerSockets.delete(playerId);
        this.broadcastState(game.code);
        // Don't stall the round if the last un-answered player left.
        if (game.phase === 'question' && game.allConnectedAnswered()) {
          this.revealNow(game.code);
        }
      }
      if (code) this.scheduleCleanupIfEmpty(code);
    });
  }

  /** Stop all pending timers (used on shutdown). */
  dispose(): void {
    for (const code of [...this.phaseTimers.keys()]) this.clearTimer(code);
    for (const timer of this.cleanupTimers.values()) clearTimeout(timer);
    this.cleanupTimers.clear();
  }

  // --- Rooms -----------------------------------------------------------------

  private createRoom(): GameManager {
    let code = generateGameCode();
    while (this.games.has(code)) {
      code = generateGameCode();
    }
    const game = new GameManager({ code, questionPool: this.questionPool });
    this.games.set(code, game);
    return game;
  }

  private removeRoom(code: string): void {
    this.clearTimer(code);
    const cleanup = this.cleanupTimers.get(code);
    if (cleanup) {
      clearTimeout(cleanup);
      this.cleanupTimers.delete(code);
    }
    this.games.delete(code);
  }

  private cancelCleanup(code: string): void {
    const timer = this.cleanupTimers.get(code);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(code);
    }
  }

  private scheduleCleanupIfEmpty(code: string): void {
    if (!this.games.has(code)) return;
    if ((this.io.sockets.adapter.rooms.get(code)?.size ?? 0) > 0) return;
    this.cancelCleanup(code);
    this.cleanupTimers.set(
      code,
      setTimeout(() => this.removeRoom(code), ROOM_CLEANUP_GRACE_MS),
    );
  }

  // --- Round flow ------------------------------------------------------------

  private socketGame(socket: QuizSocket): GameManager | undefined {
    return socket.data.code ? this.games.get(socket.data.code) : undefined;
  }

  private requireAdminGame(socket: QuizSocket): GameManager | null {
    const game = this.socketGame(socket);
    if (socket.data.role !== 'admin' || !game) {
      socket.emit('errorMessage', 'You are not the admin of a game.');
      return null;
    }
    return game;
  }

  private onQuestionBegan(code: string): void {
    const game = this.games.get(code);
    if (!game) return;
    const state = game.getPublicState();
    this.broadcastState(code, state);
    if (state.currentQuestion && state.endsAt !== null) {
      this.io
        .to(code)
        .emit('questionStarted', state.currentQuestion, state.endsAt);
      this.scheduleReveal(code, state.endsAt);
    }
  }

  private revealNow(code: string): void {
    const game = this.games.get(code);
    if (game?.phase !== 'question') return;
    this.clearTimer(code);
    game.reveal();
    this.onReveal(code);
    this.scheduleAutoAdvance(code);
  }

  /**
   * Advance one phase (reveal -> leaderboard -> next question/end), emit the
   * right events for the new phase, and queue the next auto-advance if enabled.
   */
  private applyAdvance(code: string): void {
    const game = this.games.get(code);
    if (!game) return;
    this.clearTimer(code);
    const before = game.phase;
    game.advance();
    const after = game.phase;
    if (before === 'question' && after === 'reveal') {
      this.onReveal(code);
    } else if (after === 'question') {
      this.onQuestionBegan(code);
    } else {
      this.broadcastState(code);
    }
    this.scheduleAutoAdvance(code);
  }

  /**
   * When auto-advance is enabled, queue the transition out of the current
   * reveal/leaderboard phase after the configured delay. Other phases (question
   * countdowns, ended) are handled elsewhere or need no timer.
   */
  private scheduleAutoAdvance(code: string): void {
    const game = this.games.get(code);
    if (!game) return;
    const { settings } = game.getPublicState();
    if (!settings.autoAdvance) return;
    let delaySeconds: number;
    if (game.phase === 'reveal') {
      delaySeconds = settings.revealSeconds;
    } else if (game.phase === 'leaderboard') {
      delaySeconds = settings.leaderboardSeconds;
    } else {
      return;
    }
    this.clearTimer(code);
    this.phaseTimers.set(
      code,
      setTimeout(() => this.applyAdvance(code), delaySeconds * 1000),
    );
  }

  private onReveal(code: string): void {
    const game = this.games.get(code);
    if (!game) return;
    for (const [playerId, socketId] of this.playerSockets) {
      if (game.hasPlayer(playerId)) {
        this.io.to(socketId).emit('answerResult', game.getAnswerResult(playerId));
      }
    }
    this.broadcastState(code);
  }

  private scheduleReveal(code: string, endsAt: number): void {
    this.clearTimer(code);
    const delay = Math.max(0, endsAt - Date.now());
    this.phaseTimers.set(
      code,
      setTimeout(() => this.revealNow(code), delay),
    );
  }

  private clearTimer(code: string): void {
    const timer = this.phaseTimers.get(code);
    if (timer) {
      clearTimeout(timer);
      this.phaseTimers.delete(code);
    }
  }

  private broadcastState(
    code: string,
    state = this.games.get(code)?.getPublicState(),
  ): void {
    if (state) {
      this.io.to(code).emit('gameState', state);
    }
  }
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
