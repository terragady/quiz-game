/** Difficulty levels, matching Open Trivia DB. */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** The three participant roles in a game. */
export type Role = 'host' | 'player' | 'admin';

/**
 * Lifecycle of a single game.
 * lobby -> question -> reveal -> leaderboard -> (question | ended)
 */
export type GamePhase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'ended';

/** A full question as stored on the server, including the correct answer. */
export interface Question {
  id: string;
  category: string;
  difficulty: Difficulty;
  text: string;
  /** 2 options for True/False, up to 4 for multiple choice. */
  options: string[];
  /** Index into `options` of the correct answer. */
  correctIndex: number;
  /** Optional image shown with the question (e.g. a flag to identify). */
  imageUrl?: string;
}

/** A question as sent to clients while it is being asked — no correct answer. */
export interface PublicQuestion {
  id: string;
  /** 1-based position in the current game. */
  number: number;
  /** Total questions in the current game. */
  total: number;
  category: string;
  difficulty: Difficulty;
  text: string;
  options: string[];
  /** Optional image shown with the question (e.g. a flag to identify). */
  imageUrl?: string;
}

/** Settings chosen by the admin before starting a game. */
export interface GameSettings {
  questionCount: number;
  secondsPerQuestion: number;
  /** Category name to filter by, or null for any. */
  category: string | null;
  /** Difficulty to filter by, or null for any. */
  difficulty: Difficulty | null;
  /**
   * When true, the game advances on its own: reveal -> leaderboard -> next
   * question, using the delays below. The admin can still advance manually.
   */
  autoAdvance: boolean;
  /** Seconds to stay on the answer reveal before showing the leaderboard. */
  revealSeconds: number;
  /** Seconds to stay on the leaderboard before the next question. */
  leaderboardSeconds: number;
}

/** A player as visible to everyone (no per-answer detail). */
export interface PublicPlayer {
  id: string;
  nickname: string;
  score: number;
  connected: boolean;
  /** Whether the player has answered the current question. */
  hasAnswered: boolean;
}

/** End-of-game per-player statistics ("for nerds"). */
export interface PlayerStats {
  /** Questions answered correctly. */
  correct: number;
  /** Questions answered incorrectly. */
  incorrect: number;
  /** Questions the player did not answer in time. */
  unanswered: number;
  /** Average time to answer, in ms, over answered questions (null if none). */
  averageResponseMs: number | null;
  /** Fastest correct answer, in ms (null if no correct answers). */
  fastestCorrectMs: number | null;
}

/** One row of the leaderboard, ranked high-to-low by score. */
export interface LeaderboardRow {
  playerId: string;
  nickname: string;
  score: number;
  /** 1-based rank; ties share the same rank. */
  rank: number;
  /** Points earned on the most recently revealed question. */
  lastPoints: number;
  /** Full-game statistics, present only once the game has ended. */
  stats?: PlayerStats;
}

/** Per-player result delivered when a question is revealed. */
export interface AnswerResult {
  questionId: string;
  correct: boolean;
  correctIndex: number;
  /** The option this player picked, or null if they did not answer. */
  selectedIndex: number | null;
  pointsAwarded: number;
  totalScore: number;
  rank: number;
}

/** The shared, broadcastable view of the whole game. */
export interface PublicGameState {
  code: string;
  phase: GamePhase;
  settings: GameSettings;
  players: PublicPlayer[];
  /** Present during `question` and `reveal` phases. */
  currentQuestion: PublicQuestion | null;
  /** During `reveal`, the correct option index; otherwise null. */
  revealedCorrectIndex: number | null;
  /** Absolute epoch-ms deadline for the current question, or null. */
  endsAt: number | null;
  answeredCount: number;
  playerCount: number;
  /** Populated during `leaderboard` and `ended` phases. */
  leaderboard: LeaderboardRow[];
}

/** Category with the count of available questions, for admin settings. */
export interface CategorySummary {
  name: string;
  count: number;
}

/** Acknowledgement returned when joining a game. */
export type JoinAck =
  | { ok: true; playerId: string; state: PublicGameState }
  | { ok: false; error: string };

/** Acknowledgement returned to host/admin joins (no player identity). */
export type ObserverJoinAck =
  | { ok: true; state: PublicGameState; categories: CategorySummary[] }
  | { ok: false; error: string };
