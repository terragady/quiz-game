import type { GameSettings } from './types.js';

export const GAME_CODE_LENGTH = 4;

export const MAX_NICKNAME_LENGTH = 16;

export const BASE_POINTS = 1000;

export const START_COUNTDOWN_SECONDS = 5;

// How long the category is shown before each question. Kept short on purpose.
export const CATEGORY_INTRO_MS = 2000;

// Points lost for a wrong answer when the penalty setting is on. A score never
// drops below zero.
export const WRONG_ANSWER_PENALTY = 250;

// Emojis players can send to the big screen, and how often each player may.
export const REACTIONS = ['👏', '😂', '😮', '🔥', '😭', '🎉'] as const;
export const REACTION_COOLDOWN_MS = 400;

export const ANSWER_REJECTION = {
  notAcceptingAnswers: 'Not accepting answers right now.',
  invalidOption: 'Invalid option.',
  alreadyAnswered: 'You already answered.',
  timeUp: 'Time is up.',
} as const;

export const BENIGN_ANSWER_ERRORS: readonly string[] =
  Object.values(ANSWER_REJECTION);

export const DEFAULT_SETTINGS: GameSettings = {
  questionCount: 10,
  secondsPerQuestion: 20,
  categories: [],
  difficulty: null,
  autoAdvance: true,
  revealSeconds: 5,
  leaderboardSeconds: 8,
  categoryIntro: true,
  showVoters: true,
  wrongAnswerPenalty: false,
  musicQuestions: true,
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
