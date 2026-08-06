import type {
  AnswerResult,
  GameSettings,
  JoinAck,
  ObserverJoinAck,
  PublicGameState,
  PublicQuestion,
  Role,
} from './types.js';

/** Events the server emits to clients. */
export interface ServerToClientEvents {
  /** Full state sync — the primary source of truth for all views. */
  gameState: (state: PublicGameState) => void;
  /** Fired when a new question begins, so clients can reset local UI. */
  questionStarted: (question: PublicQuestion, endsAt: number) => void;
  /** Sent to a single player when a question is revealed. */
  answerResult: (result: AnswerResult) => void;
  /** Human-readable error for display. */
  errorMessage: (message: string) => void;
}

/** Events clients emit to the server. */
export interface ClientToServerEvents {
  /**
   * Host/TV screen attaches to a game. With a `code` it rejoins that room if it
   * still exists (stable across refreshes); otherwise a new room is created.
   */
  hostJoin: (
    payload: { code?: string },
    ack: (result: ObserverJoinAck) => void,
  ) => void;
  /** Player joins with a code and nickname. */
  playerJoin: (
    payload: { code: string; nickname: string },
    ack: (result: JoinAck) => void,
  ) => void;
  /**
   * Re-attach an existing player to a new socket after a drop or refresh. The
   * `playerId` acts as a bearer token: it is proof the client was this player.
   * Works even after the game has started, unlike {@link playerJoin}.
   */
  playerRejoin: (
    payload: { code: string; playerId: string },
    ack: (result: JoinAck) => void,
  ) => void;
  /** Admin remote attaches to an existing game. */
  adminJoin: (
    payload: { code: string },
    ack: (result: ObserverJoinAck) => void,
  ) => void;
  /** Admin starts the game with the chosen settings. */
  adminStart: (settings: GameSettings) => void;
  /** Admin advances from reveal/leaderboard to the next question (or ends). */
  adminNext: () => void;
  /** Admin ends the game immediately. */
  adminEnd: () => void;
  /** Player submits an answer to the current question. */
  submitAnswer: (payload: { optionIndex: number }) => void;
}

/** Reserved for server-to-server events (unused; single instance). */
export type InterServerEvents = Record<string, never>;

/** Per-connection data attached to each socket. */
export interface SocketData {
  role: Role;
  code: string;
  playerId?: string;
}
