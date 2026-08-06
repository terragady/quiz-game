import type { GameSettings } from './types.js';

export const GAME_CODE_LENGTH = 4;

export const MAX_NICKNAME_LENGTH = 16;

export const BASE_POINTS = 1000;

export const DEFAULT_SETTINGS: GameSettings = {
  questionCount: 10,
  secondsPerQuestion: 20,
  category: null,
  difficulty: null,
  autoAdvance: true,
  revealSeconds: 5,
  leaderboardSeconds: 8,
};

export const SETTINGS_LIMITS = {
  minQuestionCount: 1,
  maxQuestionCount: 50,
  minSecondsPerQuestion: 5,
  maxSecondsPerQuestion: 120,
  minRevealSeconds: 2,
  maxRevealSeconds: 30,
  minLeaderboardSeconds: 2,
  maxLeaderboardSeconds: 60,
} as const;
