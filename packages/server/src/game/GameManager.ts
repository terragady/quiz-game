import { randomUUID } from 'node:crypto';

import {
  ANSWER_REJECTION,
  BASE_POINTS,
  calculateScore,
  CATEGORY_INTRO_MS,
  DEFAULT_SETTINGS,
  MAX_NICKNAME_LENGTH,
  SETTINGS_LIMITS,
  START_COUNTDOWN_SECONDS,
  WRONG_ANSWER_PENALTY,
  type AnswerResult,
  type GamePhase,
  type GameSettings,
  type LeaderboardRow,
  type PlayerStats,
  type PublicGameState,
  type PublicPlayer,
  type PublicQuestion,
  type Question,
} from '@quiz/shared';

import {
  selectQuestions,
  shuffle,
  type SelectionCriteria,
} from '../questions/loader.js';

// With music questions on, about one question in this many is a tune.
const ONE_TUNE_IN = 5;

interface CurrentAnswer {
  optionIndex: number;
  timeRemainingMs: number;
}

interface RunningStats {
  correct: number;
  incorrect: number;
  unanswered: number;
  answeredCount: number;
  totalResponseMs: number;
  fastestCorrectMs: number | null;
  bestStreak: number;
}

interface InternalPlayer {
  id: string;
  nickname: string;
  score: number;
  connected: boolean;
  lastPoints: number;
  streak: number;
  currentAnswer: CurrentAnswer | null;
  stats: RunningStats;
}

export interface SubmitResult {
  accepted: boolean;
  reason?: string;
}

export interface GameManagerOptions {
  code: string;
  questionPool: Question[];
  now?: () => number;
  startCountdownMs?: number;
  introMs?: number;
}

export class GameManager {
  readonly code: string;

  private readonly questionPool: Question[];
  private readonly now: () => number;
  private readonly startCountdownMs: number;
  private readonly introMs: number;

  private phaseValue: GamePhase = 'lobby';
  private settingsValue: GameSettings | null = null;
  private readonly players = new Map<string, InternalPlayer>();
  private questions: Question[] = [];
  private questionIndex = -1;
  private endsAt: number | null = null;
  // Questions this room has already played, so "Play again" brings new ones.
  private readonly usedQuestionIds = new Set<string>();

  constructor(options: GameManagerOptions) {
    this.code = options.code;
    this.questionPool = options.questionPool;
    this.now = options.now ?? (() => Date.now());
    this.startCountdownMs =
      options.startCountdownMs ?? START_COUNTDOWN_SECONDS * 1000;
    this.introMs = options.introMs ?? CATEGORY_INTRO_MS;
  }

  get phase(): GamePhase {
    return this.phaseValue;
  }

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
    const sameName = [...this.players.values()].find(
      (p) => p.nickname.toLowerCase() === trimmed.toLowerCase(),
    );
    if (sameName?.connected) {
      throw new Error('That nickname is already taken.');
    }
    // A disconnected player with this name is most likely the same person
    // joining again (e.g. their phone reloaded after the game ended and the
    // host pressed Play again). We're in the lobby, so there's no score to
    // lose: hand the name over instead of leaving a ghost seat behind.
    if (sameName) {
      this.players.delete(sameName.id);
    }

    const id = randomUUID();
    this.players.set(id, {
      id,
      nickname: trimmed,
      score: 0,
      connected: true,
      lastPoints: 0,
      streak: 0,
      currentAnswer: null,
      stats: emptyStats(),
    });
    return id;
  }

  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  nicknameOf(playerId: string): string | undefined {
    return this.players.get(playerId)?.nickname;
  }

  removePlayer(playerId: string): boolean {
    return this.players.delete(playerId);
  }

  setConnected(playerId: string, connected: boolean): void {
    const player = this.players.get(playerId);
    if (player) {
      player.connected = connected;
    }
  }

  start(settings: GameSettings): void {
    if (this.phaseValue !== 'lobby') {
      throw new Error('The game has already started.');
    }
    const validated = validateSettings(settings);
    const selected = this.pickQuestions(validated);
    if (selected.length === 0) {
      throw new Error('No questions match the selected filters.');
    }
    this.settingsValue = validated;
    this.questions = selected;
    this.questionIndex = -1;
    this.endsAt = this.now() + this.startCountdownMs;
    this.phaseValue = 'countdown';
  }

  beginQuestions(): void {
    if (this.phaseValue !== 'countdown') {
      throw new Error('The game is not counting down.');
    }
    this.beginNextQuestion();
  }

  // Ends the category intro and opens the question for answers.
  startQuestion(): void {
    if (this.phaseValue !== 'intro') {
      throw new Error('There is no question waiting to start.');
    }
    this.openQuestion();
  }

  submitAnswer(playerId: string, optionIndex: number): SubmitResult {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error('Unknown player.');
    }
    if (this.phaseValue !== 'question') {
      return { accepted: false, reason: ANSWER_REJECTION.notAcceptingAnswers };
    }
    const question = this.currentQuestion();
    if (
      !Number.isInteger(optionIndex) ||
      optionIndex < 0 ||
      optionIndex >= question.options.length
    ) {
      return { accepted: false, reason: ANSWER_REJECTION.invalidOption };
    }
    if (player.currentAnswer) {
      return { accepted: false, reason: ANSWER_REJECTION.alreadyAnswered };
    }
    const now = this.now();
    if (this.endsAt !== null && now > this.endsAt) {
      return { accepted: false, reason: ANSWER_REJECTION.timeUp };
    }
    const timeRemainingMs =
      this.endsAt !== null ? Math.max(0, this.endsAt - now) : 0;
    player.currentAnswer = { optionIndex, timeRemainingMs };
    return { accepted: true };
  }

  allConnectedAnswered(): boolean {
    const connected = [...this.players.values()].filter((p) => p.connected);
    if (connected.length === 0) {
      return false;
    }
    return connected.every((p) => p.currentAnswer !== null);
  }

  reveal(): void {
    if (this.phaseValue !== 'question') {
      return;
    }
    const question = this.currentQuestion();
    const durationMs = this.settings().secondsPerQuestion * 1000;
    for (const player of this.players.values()) {
      const answer = player.currentAnswer;
      const correct = answer?.optionIndex === question.correctIndex;
      const points =
        answer && !correct && this.settings().wrongAnswerPenalty
          ? 0 - Math.min(WRONG_ANSWER_PENALTY, player.score)
          : calculateScore({
              correct,
              timeRemainingMs: answer?.timeRemainingMs ?? 0,
              questionDurationMs: durationMs,
              basePoints: BASE_POINTS,
            });
      player.lastPoints = points;
      player.score += points;
      player.streak = correct ? player.streak + 1 : 0;
      player.stats.bestStreak = Math.max(
        player.stats.bestStreak,
        player.streak,
      );
      this.recordStats(player, answer, correct, durationMs);
    }
    this.endsAt = null;
    this.phaseValue = 'reveal';
  }

  advance(): void {
    switch (this.phaseValue) {
      case 'intro':
        this.openQuestion();
        break;
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

  end(): void {
    this.endsAt = null;
    this.phaseValue = 'ended';
  }

  // Sends a finished game back to the lobby so the same players can play
  // another round with the same code. Everyone keeps their seat, but scores
  // and stats start from zero. Already in the lobby (e.g. the button was
  // pressed twice) is a no-op.
  resetToLobby(): void {
    if (this.phaseValue === 'lobby') return;
    if (this.phaseValue !== 'ended') {
      throw new Error('The game has not ended yet.');
    }
    for (const player of this.players.values()) {
      player.score = 0;
      player.lastPoints = 0;
      player.streak = 0;
      player.currentAnswer = null;
      player.stats = emptyStats();
    }
    this.settingsValue = null;
    this.questions = [];
    this.questionIndex = -1;
    this.endsAt = null;
    this.phaseValue = 'lobby';
  }

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
      streak: player.streak,
    };
  }

  getPublicState(): PublicGameState {
    return {
      code: this.code,
      phase: this.phaseValue,
      settings: this.settingsValue ?? defaultSettingsSnapshot(),
      players: this.publicPlayers(),
      currentQuestion: this.publicQuestion(),
      revealedCorrectIndex:
        this.phaseValue === 'reveal'
          ? this.currentQuestion().correctIndex
          : null,
      endsAt: this.endsAt,
      answeredCount: this.answeredCount(),
      playerCount: this.players.size,
      upcoming: this.upcoming(),
      optionCounts: this.phaseValue === 'reveal' ? this.optionCounts() : null,
      optionVoters:
        this.phaseValue === 'reveal' && this.settings().showVoters
          ? this.optionVoters()
          : null,
      leaderboard: this.leaderboard(),
    };
  }

  private pickQuestions(settings: GameSettings): Question[] {
    const filters = {
      categories: settings.categories,
      difficulty: settings.difficulty,
    };
    const tuneCount = settings.musicQuestions
      ? Math.round(settings.questionCount / ONE_TUNE_IN)
      : 0;
    const tunes = this.pickFresh(
      this.questionPool.filter((q) => q.melody),
      { ...filters, count: tuneCount },
    );
    const others = this.pickFresh(
      this.questionPool.filter((q) => !q.melody),
      { ...filters, count: settings.questionCount - tunes.length },
    );
    return shuffle([...tunes, ...others]);
  }

  // Prefers questions this room hasn't played yet. When too few are left,
  // that group of questions starts over.
  private pickFresh(pool: Question[], criteria: SelectionCriteria): Question[] {
    if (criteria.count <= 0) return [];
    const unused = pool.filter((q) => !this.usedQuestionIds.has(q.id));
    let selected = selectQuestions(unused, criteria);
    if (selected.length < criteria.count) {
      selected = selectQuestions(pool, criteria);
      for (const question of pool) this.usedQuestionIds.delete(question.id);
    }
    for (const question of selected) this.usedQuestionIds.add(question.id);
    return selected;
  }

  private beginNextQuestion(): void {
    this.questionIndex += 1;
    for (const player of this.players.values()) {
      player.currentAnswer = null;
      player.lastPoints = 0;
    }
    if (this.settings().categoryIntro) {
      this.endsAt = this.now() + this.introMs;
      this.phaseValue = 'intro';
    } else {
      this.openQuestion();
    }
  }

  private openQuestion(): void {
    this.endsAt = this.now() + this.settings().secondsPerQuestion * 1000;
    this.phaseValue = 'question';
  }

  private upcoming(): PublicGameState['upcoming'] {
    if (this.phaseValue !== 'intro') return null;
    return {
      category: this.currentQuestion().category,
      number: this.questionIndex + 1,
      total: this.questions.length,
    };
  }

  private recordStats(
    player: InternalPlayer,
    answer: CurrentAnswer | null,
    correct: boolean,
    durationMs: number,
  ): void {
    const stats = player.stats;
    if (!answer) {
      stats.unanswered += 1;
      return;
    }
    const responseMs = Math.max(0, durationMs - answer.timeRemainingMs);
    stats.answeredCount += 1;
    stats.totalResponseMs += responseMs;
    if (correct) {
      stats.correct += 1;
      if (
        stats.fastestCorrectMs === null ||
        responseMs < stats.fastestCorrectMs
      ) {
        stats.fastestCorrectMs = responseMs;
      }
    } else {
      stats.incorrect += 1;
    }
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
      ...(question.imageUrl !== undefined
        ? { imageUrl: question.imageUrl }
        : {}),
      ...(question.melody !== undefined ? { melody: question.melody } : {}),
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

  private optionCounts(): number[] {
    return this.optionVoters().map((names) => names.length);
  }

  private optionVoters(): string[][] {
    const question = this.currentQuestion();
    const voters: string[][] = question.options.map(() => []);
    for (const player of this.players.values()) {
      const index = player.currentAnswer?.optionIndex;
      if (index !== undefined && index >= 0 && index < voters.length) {
        voters[index].push(player.nickname);
      }
    }
    return voters;
  }

  private leaderboard(): LeaderboardRow[] {
    const sorted = [...this.players.values()].sort((a, b) => b.score - a.score);
    const includeStats = this.phaseValue === 'ended';
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
        streak: player.streak,
        ...(includeStats ? { stats: projectStats(player.stats) } : {}),
      };
    });
  }

  private rankOf(playerId: string): number {
    return (
      this.leaderboard().find((row) => row.playerId === playerId)?.rank ?? 0
    );
  }
}

function emptyStats(): RunningStats {
  return {
    correct: 0,
    incorrect: 0,
    unanswered: 0,
    answeredCount: 0,
    totalResponseMs: 0,
    fastestCorrectMs: null,
    bestStreak: 0,
  };
}

function projectStats(stats: RunningStats): PlayerStats {
  return {
    correct: stats.correct,
    incorrect: stats.incorrect,
    unanswered: stats.unanswered,
    averageResponseMs:
      stats.answeredCount > 0
        ? Math.round(stats.totalResponseMs / stats.answeredCount)
        : null,
    fastestCorrectMs: stats.fastestCorrectMs,
    bestStreak: stats.bestStreak,
  };
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
    categories: normalizeCategories(settings.categories),
    difficulty: settings.difficulty,
    autoAdvance: Boolean(settings.autoAdvance),
    revealSeconds: settings.revealSeconds,
    leaderboardSeconds: settings.leaderboardSeconds,
    categoryIntro: booleanOr(
      settings.categoryIntro,
      DEFAULT_SETTINGS.categoryIntro,
    ),
    showVoters: booleanOr(settings.showVoters, DEFAULT_SETTINGS.showVoters),
    wrongAnswerPenalty: booleanOr(
      settings.wrongAnswerPenalty,
      DEFAULT_SETTINGS.wrongAnswerPenalty,
    ),
    musicQuestions: booleanOr(
      settings.musicQuestions,
      DEFAULT_SETTINGS.musicQuestions,
    ),
  };
}

// Settings from an older client may not have the newer switches yet.
function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeCategories(categories: unknown): string[] {
  if (!Array.isArray(categories)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of categories) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function defaultSettingsSnapshot(): GameSettings {
  return {
    questionCount: 0,
    secondsPerQuestion: 0,
    categories: [],
    difficulty: null,
    autoAdvance: false,
    revealSeconds: 0,
    leaderboardSeconds: 0,
    categoryIntro: false,
    showVoters: false,
    wrongAnswerPenalty: false,
    musicQuestions: false,
  };
}
