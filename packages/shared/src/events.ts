import type {
  AnswerResult,
  GameSettings,
  JoinAck,
  ObserverJoinAck,
  PublicGameState,
  PublicQuestion,
  Role,
} from './types.js';

export interface ServerToClientEvents {
  gameState: (state: PublicGameState) => void;
  questionStarted: (question: PublicQuestion, endsAt: number) => void;
  answerResult: (result: AnswerResult) => void;
  errorMessage: (message: string) => void;
}

export interface ClientToServerEvents {
  hostJoin: (
    payload: { code?: string },
    ack: (result: ObserverJoinAck) => void,
  ) => void;
  playerJoin: (
    payload: { code: string; nickname: string },
    ack: (result: JoinAck) => void,
  ) => void;
  playerRejoin: (
    payload: { code: string; playerId: string },
    ack: (result: JoinAck) => void,
  ) => void;
  adminJoin: (
    payload: { code: string },
    ack: (result: ObserverJoinAck) => void,
  ) => void;
  adminStart: (settings: GameSettings) => void;
  adminNext: () => void;
  adminEnd: () => void;
  submitAnswer: (payload: { optionIndex: number }) => void;
}

export type InterServerEvents = Record<string, never>;

export interface SocketData {
  role: Role;
  code: string;
  playerId?: string;
}
