import { randomUUID } from 'node:crypto';
import {
  BASE_POINTS,
  calculateScore,
  MAX_NICKNAME_LENGTH,
  SETTINGS_LIMITS,
  type AnswerResult,
  type GamePhase,
  type GameSettings,
  type LeaderboardRow,
  type PublicGameState,
  type PublicPlayer,
  type PublicQuestion,
  type Question,
} from '@quiz/shared';
import { selectQuestions } from '../questions/loader.js';

interface CurrentAnswer {
  optionIndex: number;
  timeRemainingMs: number;
}

interface InternalPlayer {
  id: string;
  nickname: string;
  score: number;
  connected: boolean;
  lastPoints: number;
  currentAnswer: CurrentAnswer | null;
}

export interface SubmitResult {
  accepted: boolean;
  reason?: string;
}

export interface GameManagerOptions {
  code: string;
  questionPool: Question[];
  /** Injectable clock for deterministic testing. */
  now?: () => number;
}

/**
 * In-memory state machine for a single game.
 * Phases: lobby -> question -> reveal -> leaderboard -> (question | ended)
 */
export class GameManager {
  readonly code: string;

  private readonly questionPool: Question[];
  private readonly now: () => number;

  private phaseValue: GamePhase = 'lobby';
  private settingsValue: GameSettings | null = null;
  private readonly players = new Map<string, InternalPlayer>();
  private questions: Question[] = [];
  private questionIndex = -1;
  private endsAt: number | null = null;

  constructor(options: GameManagerOptions) {
    this.code = options.code;
    this.questionPool = options.questionPool;
    this.now = options.now ?? (() => Date.now());
  }

  get phase(): GamePhase {
    return this.phaseValue;
  }

  // --- Lobby -----------------------------------------------------------------

  /** Add a player during the lobby. Returns the new player's id. */
  addPlayer(nickname: string): string {
    if (this.phaseValue !== 'lobby') {
      throw new Error('The game has already started.');
    }
    const trimmed = nickname.trim();
    if (trimmed.length === 0) {
      throw new Error('Nickname cannot be empty.');
    }
    if (trimmed.length > MAX_NICKNAME_LENGTH) {
      throw new Error(
        `Nickname must be at most ${MAX_NICKNAME_LENGTH} characters.`,
      );
    }
    const taken = [...this.players.values()].some(
      (p) => p.nickname.toLowerCase() === trimmed.toLowerCase(),
    );
    if (taken) {
      throw new Error('That nickname is already taken.');
    }

    const id = randomUUID();
    this.players.set(id, {
      id,
      nickname: trimmed,
      score: 0,
      connected: true,
      lastPoints: 0,
      currentAnswer: null,
    });
    return id;
  }

  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  setConnected(playerId: string, connected: boolean): void {
    const player = this.players.get(playerId);
    if (player) {
      player.connected = connected;
    }
  }

  // --- Game flow -------------------------------------------------------------

  /** Start the game with validated settings and begin the first question. */
  start(settings: GameSettings): void {
    if (this.phaseValue !== 'lobby') {
      throw new Error('The game has already started.');
    }
    const validated = validateSettings(settings);
    const selected = selectQuestions(this.questionPool, {
      count: validated.questionCount,
      category: validated.category,
      difficulty: validated.difficulty,
    });
    if (selected.length === 0) {
      throw new Error('No questions match the selected filters.');
    }
    this.settingsValue = validated;
    this.questions = selected;
    this.questionIndex = -1;
    this.beginNextQuestion();
  }

  /** Record a player's answer to the current question. */
  submitAnswer(playerId: string, optionIndex: number): SubmitResult {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error('Unknown player.');
    }
    if (this.phaseValue !== 'question') {
      return { accepted: false, reason: 'Not accepting answers right now.' };
    }
    const question = this.currentQuestion();
    if (
      !Number.isInteger(optionIndex) ||
      optionIndex < 0 ||
      optionIndex >= question.options.length
    ) {
      return { accepted: false, reason: 'Invalid option.' };
    }
    if (player.currentAnswer) {
      return { accepted: false, reason: 'You already answered.' };
    }
    const now = this.now();
    if (this.endsAt !== null && now > this.endsAt) {
      return { accepted: false, reason: 'Time is up.' };
    }
    const timeRemainingMs = this.endsAt !== null ? Math.max(0, this.endsAt - now) : 0;
    player.currentAnswer = { optionIndex, timeRemainingMs };
    return { accepted: true };
  }

  /** True when every connected player has answered the current question. */
  allConnectedAnswered(): boolean {
    const connected = [...this.players.values()].filter((p) => p.connected);
    if (connected.length === 0) {
      return false;
    }
    return connected.every((p) => p.currentAnswer !== null);
  }

  /** Move from `question` to `reveal`, scoring every player's answer. */
  reveal(): void {
    if (this.phaseValue !== 'question') {
      return;
    }
    const question = this.currentQuestion();
    const durationMs = (this.settings().secondsPerQuestion) * 1000;
    for (const player of this.players.values()) {
      const answer = player.currentAnswer;
      const correct = answer?.optionIndex === question.correctIndex;
      const points = calculateScore({
        correct,
        timeRemainingMs: answer?.timeRemainingMs ?? 0,
        questionDurationMs: durationMs,
        basePoints: BASE_POINTS,
      });
      player.lastPoints = points;
      player.score += points;
    }
    this.endsAt = null;
    this.phaseValue = 'reveal';
  }

  /** Admin "next": advance through reveal -> leaderboard -> next question/end. */
  advance(): void {
    switch (this.phaseValue) {
      case 'question':
        this.reveal();
        break;
      case 'reveal':
        this.phaseValue = 'leaderboard';
        break;
      case 'leaderboard':
        if (this.questionIndex < this.questions.length - 1) {
          this.beginNextQuestion();
        } else {
          this.phaseValue = 'ended';
        }
        break;
      default:
        break;
    }
  }

  /** End the game immediately. */
  end(): void {
    this.endsAt = null;
    this.phaseValue = 'ended';
  }

  // --- Projections -----------------------------------------------------------

  /** The per-player result to send once a question is revealed. */
  getAnswerResult(playerId: string): AnswerResult {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error('Unknown player.');
    }
    const question = this.currentQuestion();
    return {
      questionId: question.id,
      correct: player.currentAnswer?.optionIndex === question.correctIndex,
      correctIndex: question.correctIndex,
      selectedIndex: player.currentAnswer?.optionIndex ?? null,
      pointsAwarded: player.lastPoints,
      totalScore: player.score,
      rank: this.rankOf(playerId),
    };
  }

  /** The broadcastable state shared by all roles (never leaks the answer). */
  getPublicState(): PublicGameState {
    return {
      code: this.code,
      phase: this.phaseValue,
      settings: this.settingsValue ?? defaultSettingsSnapshot(),
      players: this.publicPlayers(),
      currentQuestion: this.publicQuestion(),
      revealedCorrectIndex:
        this.phaseValue === 'reveal' ? this.currentQuestion().correctIndex : null,
      endsAt: this.endsAt,
      answeredCount: this.answeredCount(),
      playerCount: this.players.size,
      leaderboard: this.leaderboard(),
    };
  }

  // --- Internals -------------------------------------------------------------

  private beginNextQuestion(): void {
    this.questionIndex += 1;
    for (const player of this.players.values()) {
      player.currentAnswer = null;
      player.lastPoints = 0;
    }
    this.endsAt = this.now() + this.settings().secondsPerQuestion * 1000;
    this.phaseValue = 'question';
  }

  private settings(): GameSettings {
    if (!this.settingsValue) {
      throw new Error('The game has not been started.');
    }
    return this.settingsValue;
  }

  private currentQuestion(): Question {
    const question = this.questions[this.questionIndex];
    if (!question) {
      throw new Error('There is no current question.');
    }
    return question;
  }

  private publicQuestion(): PublicQuestion | null {
    if (this.phaseValue !== 'question' && this.phaseValue !== 'reveal') {
      return null;
    }
    const question = this.currentQuestion();
    return {
      id: question.id,
      number: this.questionIndex + 1,
      total: this.questions.length,
      category: question.category,
      difficulty: question.difficulty,
      text: question.text,
      options: question.options,
    };
  }

  private publicPlayers(): PublicPlayer[] {
    return [...this.players.values()].map((p) => ({
      id: p.id,
      nickname: p.nickname,
      score: p.score,
      connected: p.connected,
      hasAnswered: p.currentAnswer !== null,
    }));
  }

  private answeredCount(): number {
    return [...this.players.values()].filter((p) => p.currentAnswer !== null)
      .length;
  }

  private leaderboard(): LeaderboardRow[] {
    const sorted = [...this.players.values()].sort(
      (a, b) => b.score - a.score,
    );
    let rank = 0;
    let previousScore: number | null = null;
    return sorted.map((player, position) => {
      if (previousScore === null || player.score !== previousScore) {
        rank = position + 1;
        previousScore = player.score;
      }
      return {
        playerId: player.id,
        nickname: player.nickname,
        score: player.score,
        rank,
        lastPoints: player.lastPoints,
      };
    });
  }

  private rankOf(playerId: string): number {
    return (
      this.leaderboard().find((row) => row.playerId === playerId)?.rank ?? 0
    );
  }
}

function validateSettings(settings: GameSettings): GameSettings {
  const {
    minQuestionCount,
    maxQuestionCount,
    minSecondsPerQuestion,
    maxSecondsPerQuestion,
    minRevealSeconds,
    maxRevealSeconds,
    minLeaderboardSeconds,
    maxLeaderboardSeconds,
  } = SETTINGS_LIMITS;

  if (
    !Number.isInteger(settings.questionCount) ||
    settings.questionCount < minQuestionCount ||
    settings.questionCount > maxQuestionCount
  ) {
    throw new Error(
      `Question count must be between ${minQuestionCount} and ${maxQuestionCount}.`,
    );
  }
  if (
    !Number.isInteger(settings.secondsPerQuestion) ||
    settings.secondsPerQuestion < minSecondsPerQuestion ||
    settings.secondsPerQuestion > maxSecondsPerQuestion
  ) {
    throw new Error(
      `Seconds per question must be between ${minSecondsPerQuestion} and ${maxSecondsPerQuestion}.`,
    );
  }
  if (
    settings.difficulty !== null &&
    !['easy', 'medium', 'hard'].includes(settings.difficulty)
  ) {
    throw new Error('Invalid difficulty.');
  }
  if (
    !Number.isInteger(settings.revealSeconds) ||
    settings.revealSeconds < minRevealSeconds ||
    settings.revealSeconds > maxRevealSeconds
  ) {
    throw new Error(
      `Reveal seconds must be between ${minRevealSeconds} and ${maxRevealSeconds}.`,
    );
  }
  if (
    !Number.isInteger(settings.leaderboardSeconds) ||
    settings.leaderboardSeconds < minLeaderboardSeconds ||
    settings.leaderboardSeconds > maxLeaderboardSeconds
  ) {
    throw new Error(
      `Leaderboard seconds must be between ${minLeaderboardSeconds} and ${maxLeaderboardSeconds}.`,
    );
  }

  return {
    questionCount: settings.questionCount,
    secondsPerQuestion: settings.secondsPerQuestion,
    category: settings.category?.trim() ? settings.category.trim() : null,
    difficulty: settings.difficulty,
    autoAdvance: Boolean(settings.autoAdvance),
    revealSeconds: settings.revealSeconds,
    leaderboardSeconds: settings.leaderboardSeconds,
  };
}

function defaultSettingsSnapshot(): GameSettings {
  return {
    questionCount: 0,
    secondsPerQuestion: 0,
    category: null,
    difficulty: null,
    autoAdvance: false,
    revealSeconds: 0,
    leaderboardSeconds: 0,
  };
}
