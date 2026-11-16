import type { Melody } from './melody.js';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Role = 'host' | 'player';

export type GamePhase =
  | 'lobby'
  | 'countdown'
  | 'intro'
  | 'question'
  | 'reveal'
  | 'leaderboard'
  | 'ended';

export interface Question {
  id: string;
  category: string;
  difficulty: Difficulty;
  text: string;
  options: string[];
  correctIndex: number;
  imageUrl?: string;
  /** A tune the host screen plays for "name that tune" questions. */
  melody?: Melody;
}

export interface PublicQuestion {
  id: string;
  number: number;
  total: number;
  category: string;
  difficulty: Difficulty;
  text: string;
  options: string[];
  imageUrl?: string;
  melody?: Melody;
}

export interface GameSettings {
  questionCount: number;
  secondsPerQuestion: number;
  categories: string[];
  difficulty: Difficulty | null;
  autoAdvance: boolean;
  revealSeconds: number;
  leaderboardSeconds: number;
  /** Show the next question's category for a moment before the question. */
  categoryIntro: boolean;
  /** Show players' names on the answers they picked; off shows counts only. */
  showVoters: boolean;
  /** Wrong answers cost points. Not answering costs nothing. */
  wrongAnswerPenalty: boolean;
  /** Mix "name that tune" questions into the game. */
  musicQuestions: boolean;
}

export interface UpcomingQuestion {
  category: string;
  number: number;
  total: number;
}

export interface PublicPlayer {
  id: string;
  nickname: string;
  score: number;
  connected: boolean;
  hasAnswered: boolean;
}

export interface PlayerStats {
  correct: number;
  incorrect: number;
  unanswered: number;
  averageResponseMs: number | null;
  fastestCorrectMs: number | null;
  bestStreak: number;
}

export interface LeaderboardRow {
  playerId: string;
  nickname: string;
  score: number;
  rank: number;
  lastPoints: number;
  /** Correct answers in a row, counting back from the latest question. */
  streak: number;
  stats?: PlayerStats;
}

export interface AnswerResult {
  questionId: string;
  correct: boolean;
  correctIndex: number;
  selectedIndex: number | null;
  pointsAwarded: number;
  totalScore: number;
  rank: number;
  streak: number;
}

export interface PublicGameState {
  code: string;
  phase: GamePhase;
  settings: GameSettings;
  players: PublicPlayer[];
  currentQuestion: PublicQuestion | null;
  revealedCorrectIndex: number | null;
  endsAt: number | null;
  answeredCount: number;
  playerCount: number;
  /** Upcoming question during the category intro. */
  upcoming: UpcomingQuestion | null;
  /** How many players picked each option, during the reveal. */
  optionCounts: number[] | null;
  /** Who picked each option, during the reveal. Null when votes are anonymous. */
  optionVoters: string[][] | null;
  leaderboard: LeaderboardRow[];
}

export interface CategorySummary {
  name: string;
  count: number;
}

export type JoinAck =
  | { ok: true; playerId: string; state: PublicGameState }
  | { ok: false; error: string };

export type ObserverJoinAck =
  | { ok: true; state: PublicGameState; categories: CategorySummary[] }
  | { ok: false; error: string };
