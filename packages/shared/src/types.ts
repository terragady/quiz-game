export type Difficulty = 'easy' | 'medium' | 'hard';

export type Role = 'host' | 'player' | 'admin';

export type GamePhase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'ended';

export interface Question {
  id: string;
  category: string;
  difficulty: Difficulty;
  text: string;
  options: string[];
  correctIndex: number;
  imageUrl?: string;
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
}

export interface GameSettings {
  questionCount: number;
  secondsPerQuestion: number;
  category: string | null;
  difficulty: Difficulty | null;
  autoAdvance: boolean;
  revealSeconds: number;
  leaderboardSeconds: number;
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
}

export interface LeaderboardRow {
  playerId: string;
  nickname: string;
  score: number;
  rank: number;
  lastPoints: number;
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
