import type { GameSettings } from './types.js';

/** Number of characters in a game join code. */
export const GAME_CODE_LENGTH = 4;

/** Maximum length of a player nickname. */
export const MAX_NICKNAME_LENGTH = 16;

/** Base points for a correct answer before the speed bonus. */
export const BASE_POINTS = 1000;

/** Default settings offered to the admin. */
export const DEFAULT_SETTINGS: GameSettings = {
  questionCount: 10,
  secondsPerQuestion: 20,
  category: null,
  difficulty: null,
};

/** Bounds the admin settings are validated against. */
export const SETTINGS_LIMITS = {
  minQuestionCount: 1,
  maxQuestionCount: 50,
  minSecondsPerQuestion: 5,
  maxSecondsPerQuestion: 120,
} as const;
