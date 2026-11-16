import { BASE_POINTS, type GameSettings, type Question } from '@quiz/shared';
import { beforeEach, describe, it, expect } from 'vitest';

import { GameManager } from './GameManager.js';

const CORRECT_ANSWER = 'Correct';

function makePool(): Question[] {
  return [
    {
      id: 'q1',
      category: 'Science',
      difficulty: 'easy',
      text: 'Q1',
      options: [CORRECT_ANSWER, 'Wrong1', 'Wrong2', 'Wrong3'],
      correctIndex: 0,
    },
    {
      id: 'q2',
      category: 'Science',
      difficulty: 'easy',
      text: 'Q2',
      options: [CORRECT_ANSWER, 'Wrong1', 'Wrong2', 'Wrong3'],
      correctIndex: 0,
    },
    {
      id: 'q3',
      category: 'History',
      difficulty: 'hard',
      text: 'Q3',
      options: [CORRECT_ANSWER, 'Wrong1'],
      correctIndex: 0,
    },
  ];
}

function correctOptionIndex(game: GameManager): number {
  const question = game.getPublicState().currentQuestion;
  if (!question) {
    throw new Error('No current question.');
  }
  return question.options.indexOf(CORRECT_ANSWER);
}

function wrongOptionIndex(game: GameManager): number {
  const question = game.getPublicState().currentQuestion;
  if (!question) {
    throw new Error('No current question.');
  }
  return question.options.findIndex((option) => option !== CORRECT_ANSWER);
}

function startGame(game: GameManager, settings: GameSettings): void {
  game.start(settings);
  game.beginQuestions();
}

const baseSettings: GameSettings = {
  questionCount: 3,
  secondsPerQuestion: 20,
  categories: [],
  difficulty: null,
  autoAdvance: false,
  revealSeconds: 5,
  leaderboardSeconds: 8,
  categoryIntro: false,
  showVoters: true,
  wrongAnswerPenalty: false,
  musicQuestions: false,
};

describe('GameManager lobby', () => {
  let clock: number;
  let game: GameManager;

  beforeEach(() => {
    clock = 1000;
    game = new GameManager({
      code: 'ABCD',
      questionPool: makePool(),
      now: () => clock,
    });
  });

  it('adds a player and returns an id', () => {
    const id = game.addPlayer('Alice');
    expect(id).toBeTruthy();
    expect(game.hasPlayer(id)).toBe(true);
  });

  it('rejects an empty nickname', () => {
    expect(() => game.addPlayer('   ')).toThrow(/empty/);
  });

  it('rejects a duplicate nickname case-insensitively', () => {
    game.addPlayer('Alice');
    expect(() => game.addPlayer('alice')).toThrow(/taken/);
  });

  it('hands the nickname of a disconnected player to a new join', () => {
    const oldId = game.addPlayer('Alice');
    game.setConnected(oldId, false);
    const newId = game.addPlayer('alice');
    expect(game.hasPlayer(oldId)).toBe(false);
    expect(game.getPublicState().players.map((p) => p.id)).toEqual([newId]);
  });

  it('rejects joining after the game has started', () => {
    game.addPlayer('Alice');
    game.start(baseSettings);
    expect(() => game.addPlayer('Bob')).toThrow(/already started/);
  });
});

describe('GameManager start', () => {
  let clock: number;
  let game: GameManager;

  beforeEach(() => {
    clock = 1000;
    game = new GameManager({
      code: 'ABCD',
      questionPool: makePool(),
      now: () => clock,
    });
  });

  it('enters a countdown before the first question', () => {
    game.start({ ...baseSettings });
    const state = game.getPublicState();
    expect(state.phase).toBe('countdown');
    expect(state.currentQuestion).toBeNull();
    expect(state.endsAt).toBe(1000 + 5 * 1000);
  });

  it('uses the configured countdown duration', () => {
    const custom = new GameManager({
      code: 'ABCD',
      questionPool: makePool(),
      now: () => clock,
      startCountdownMs: 3000,
    });
    custom.start(baseSettings);
    expect(custom.getPublicState().endsAt).toBe(1000 + 3000);
  });

  it('begins the first question with a deadline after the countdown', () => {
    startGame(game, baseSettings);
    const state = game.getPublicState();
    expect(state.phase).toBe('question');
    expect(state.currentQuestion?.number).toBe(1);
    expect(state.currentQuestion?.total).toBe(3);
    expect(state.endsAt).toBe(1000 + 20 * 1000);
    expect(state.revealedCorrectIndex).toBeNull();
  });

  it('rejects beginning questions before a countdown', () => {
    expect(() => game.beginQuestions()).toThrow(/not counting down/);
  });

  it('rejects settings whose filter matches no questions', () => {
    expect(() =>
      game.start({ ...baseSettings, categories: ['Nonexistent'] }),
    ).toThrow(/No questions match/);
  });

  it('draws only from the selected categories', () => {
    startGame(game, {
      ...baseSettings,
      questionCount: 3,
      categories: ['Science'],
    });
    expect(game.getPublicState().currentQuestion?.category).toBe('Science');
    expect(game.getPublicState().currentQuestion?.total).toBe(2);
  });

  it('trims and de-duplicates selected categories', () => {
    game.start({
      ...baseSettings,
      categories: ['Science', ' Science ', 'History'],
    });
    expect(game.getPublicState().settings.categories).toEqual([
      'Science',
      'History',
    ]);
  });

  it('rejects being started twice', () => {
    game.start(baseSettings);
    expect(() => game.start(baseSettings)).toThrow(/already started/);
  });

  it('rejects an out-of-range question count', () => {
    expect(() => game.start({ ...baseSettings, questionCount: 0 })).toThrow(
      /Question count/,
    );
  });
});

describe('GameManager answering', () => {
  let clock: number;
  let game: GameManager;
  let alice: string;

  beforeEach(() => {
    clock = 1000;
    game = new GameManager({
      code: 'ABCD',
      questionPool: makePool(),
      now: () => clock,
    });
    alice = game.addPlayer('Alice');
    startGame(game, baseSettings);
  });

  it('accepts a valid answer', () => {
    expect(game.submitAnswer(alice, 0)).toEqual({ accepted: true });
  });

  it('rejects a second answer from the same player', () => {
    game.submitAnswer(alice, 0);
    expect(game.submitAnswer(alice, 1)).toMatchObject({ accepted: false });
  });

  it('rejects an answer after the deadline', () => {
    clock = 1000 + 20 * 1000 + 1;
    expect(game.submitAnswer(alice, 0)).toMatchObject({
      accepted: false,
      reason: expect.stringMatching(/Time is up/),
    });
  });

  it('rejects an out-of-range option index', () => {
    expect(game.submitAnswer(alice, 9)).toMatchObject({ accepted: false });
  });

  it('throws for an unknown player', () => {
    expect(() => game.submitAnswer('nope', 0)).toThrow(/Unknown player/);
  });

  it('does not accept answers outside the question phase', () => {
    game.reveal();
    expect(game.submitAnswer(alice, 0)).toMatchObject({ accepted: false });
  });

  it('reports when all connected players have answered', () => {
    const twoPlayerGame = new GameManager({
      code: 'WXYZ',
      questionPool: makePool(),
      now: () => clock,
    });
    const a = twoPlayerGame.addPlayer('Ann');
    const b = twoPlayerGame.addPlayer('Ben');
    startGame(twoPlayerGame, baseSettings);

    expect(twoPlayerGame.allConnectedAnswered()).toBe(false);
    twoPlayerGame.submitAnswer(a, 0);
    expect(twoPlayerGame.allConnectedAnswered()).toBe(false);
    twoPlayerGame.submitAnswer(b, 0);
    expect(twoPlayerGame.allConnectedAnswered()).toBe(true);
  });
});

describe('GameManager scoring and reveal', () => {
  let clock: number;
  let game: GameManager;
  let fast: string;
  let slow: string;
  let wrong: string;

  beforeEach(() => {
    clock = 1000;
    game = new GameManager({
      code: 'ABCD',
      questionPool: makePool(),
      now: () => clock,
    });
    fast = game.addPlayer('Fast');
    slow = game.addPlayer('Slow');
    wrong = game.addPlayer('Wrong');
    startGame(game, baseSettings);
  });

  it('awards more points to faster correct answers and none to wrong ones', () => {
    const correct = correctOptionIndex(game);
    const incorrect = wrongOptionIndex(game);
    game.submitAnswer(fast, correct);
    clock = 1000 + 10 * 1000;
    game.submitAnswer(slow, correct);
    game.submitAnswer(wrong, incorrect);

    game.reveal();

    const fastResult = game.getAnswerResult(fast);
    const slowResult = game.getAnswerResult(slow);
    const wrongResult = game.getAnswerResult(wrong);

    expect(fastResult.pointsAwarded).toBe(BASE_POINTS);
    expect(fastResult.correct).toBe(true);
    expect(slowResult.pointsAwarded).toBeGreaterThanOrEqual(BASE_POINTS / 2);
    expect(slowResult.pointsAwarded).toBeLessThan(fastResult.pointsAwarded);
    expect(wrongResult.correct).toBe(false);
    expect(wrongResult.pointsAwarded).toBe(0);
  });

  it('reveals the correct index only during the reveal phase', () => {
    const expectedIndex = correctOptionIndex(game);
    expect(game.getPublicState().revealedCorrectIndex).toBeNull();
    game.reveal();
    expect(game.getPublicState().revealedCorrectIndex).toBe(expectedIndex);
  });

  it('exposes per-option voter nicknames only during the reveal phase', () => {
    const correct = correctOptionIndex(game);
    const incorrect = wrongOptionIndex(game);
    game.submitAnswer(fast, correct);
    game.submitAnswer(slow, correct);
    game.submitAnswer(wrong, incorrect);

    expect(game.getPublicState().optionVoters).toBeNull();

    game.reveal();

    const voters = game.getPublicState().optionVoters;
    expect(voters).not.toBeNull();
    expect(voters?.[correct]).toEqual(expect.arrayContaining(['Fast', 'Slow']));
    expect(voters?.[correct]).toHaveLength(2);
    expect(voters?.[incorrect]).toEqual(['Wrong']);
  });

  it('never exposes the correct answer on the public question object', () => {
    const question = game.getPublicState().currentQuestion;
    expect(question).not.toHaveProperty('correctIndex');
  });

  it('accumulates score across questions', () => {
    game.submitAnswer(fast, correctOptionIndex(game));
    game.reveal();
    const afterFirst = game.getAnswerResult(fast).totalScore;
    game.advance();
    game.advance();
    game.submitAnswer(fast, correctOptionIndex(game));
    game.reveal();
    expect(game.getAnswerResult(fast).totalScore).toBeGreaterThan(afterFirst);
  });
});

describe('GameManager phase advancement', () => {
  let clock: number;
  let game: GameManager;

  beforeEach(() => {
    clock = 1000;
    game = new GameManager({
      code: 'ABCD',
      questionPool: makePool(),
      now: () => clock,
    });
    game.addPlayer('Alice');
    startGame(game, { ...baseSettings, questionCount: 2 });
  });

  it('walks question -> reveal -> leaderboard -> next question', () => {
    expect(game.phase).toBe('question');
    game.advance();
    expect(game.phase).toBe('reveal');
    game.advance();
    expect(game.phase).toBe('leaderboard');
    game.advance();
    expect(game.phase).toBe('question');
    expect(game.getPublicState().currentQuestion?.number).toBe(2);
  });

  it('ends the game after the last question', () => {
    game.advance();
    game.advance();
    game.advance();
    game.advance();
    game.advance();
    game.advance();
    expect(game.phase).toBe('ended');
  });

  it('can be ended immediately', () => {
    game.end();
    expect(game.phase).toBe('ended');
  });
});

describe('GameManager leaderboard', () => {
  let clock: number;
  let game: GameManager;

  beforeEach(() => {
    clock = 1000;
    game = new GameManager({
      code: 'ABCD',
      questionPool: makePool(),
      now: () => clock,
    });
  });

  it('ranks players by score with ties sharing a rank', () => {
    const a = game.addPlayer('A');
    const b = game.addPlayer('B');
    const c = game.addPlayer('C');
    startGame(game, baseSettings);
    game.submitAnswer(a, correctOptionIndex(game));
    game.submitAnswer(b, correctOptionIndex(game));
    game.submitAnswer(c, wrongOptionIndex(game));
    game.reveal();

    const rows = game.getPublicState().leaderboard;
    const rankByNickname = Object.fromEntries(
      rows.map((r) => [r.nickname, r.rank]),
    );
    expect(rankByNickname.A).toBe(1);
    expect(rankByNickname.B).toBe(1);
    expect(rankByNickname.C).toBe(3);
  });
});

describe('GameManager end-of-game stats', () => {
  let clock: number;
  let game: GameManager;

  beforeEach(() => {
    clock = 1000;
    game = new GameManager({
      code: 'ABCD',
      questionPool: makePool(),
      now: () => clock,
    });
  });

  it('exposes per-player stats only once the game has ended', () => {
    const right = game.addPlayer('Right');
    const wrongPlayer = game.addPlayer('Wrong');
    game.addPlayer('Quiet');
    startGame(game, {
      ...baseSettings,
      questionCount: 1,
      secondsPerQuestion: 20,
    });

    game.submitAnswer(right, correctOptionIndex(game));
    clock = 1000 + 5000;
    game.submitAnswer(wrongPlayer, wrongOptionIndex(game));
    game.reveal();

    expect(game.getPublicState().leaderboard[0]?.stats).toBeUndefined();

    game.advance();
    game.advance();

    const rows = game.getPublicState().leaderboard;
    const byName = Object.fromEntries(rows.map((r) => [r.nickname, r.stats]));

    expect(byName.Right).toMatchObject({
      correct: 1,
      incorrect: 0,
      unanswered: 0,
      averageResponseMs: 0,
      fastestCorrectMs: 0,
    });
    expect(byName.Wrong).toMatchObject({
      correct: 0,
      incorrect: 1,
      unanswered: 0,
      averageResponseMs: 5000,
      fastestCorrectMs: null,
    });
    expect(byName.Quiet).toMatchObject({
      correct: 0,
      incorrect: 0,
      unanswered: 1,
      averageResponseMs: null,
      fastestCorrectMs: null,
    });
  });
});

describe('GameManager play again', () => {
  let clock: number;
  let game: GameManager;

  beforeEach(() => {
    clock = 1000;
    game = new GameManager({
      code: 'ABCD',
      questionPool: makePool(),
      now: () => clock,
    });
  });

  it('sends a finished game back to the lobby with the same players and zero scores', () => {
    const alice = game.addPlayer('Alice');
    const bob = game.addPlayer('Bob');
    game.setConnected(bob, false);
    startGame(game, { ...baseSettings, questionCount: 1 });
    game.submitAnswer(alice, correctOptionIndex(game));
    game.reveal();
    game.end();

    game.resetToLobby();

    const state = game.getPublicState();
    expect(state.code).toBe('ABCD');
    expect(state.phase).toBe('lobby');
    expect(state.currentQuestion).toBeNull();
    expect(state.endsAt).toBeNull();
    expect(
      state.players.map((p) => [p.nickname, p.score, p.connected]),
    ).toEqual([
      ['Alice', 0, true],
      ['Bob', 0, false],
    ]);
    expect(state.leaderboard.every((row) => row.lastPoints === 0)).toBe(true);
    expect(game.hasPlayer(alice)).toBe(true);
    expect(game.hasPlayer(bob)).toBe(true);
  });

  it('starts the next round with fresh stats and lets new players join', () => {
    const alice = game.addPlayer('Alice');
    startGame(game, { ...baseSettings, questionCount: 1 });
    game.submitAnswer(alice, correctOptionIndex(game));
    game.reveal();
    game.end();
    game.resetToLobby();

    game.addPlayer('Carol');
    startGame(game, { ...baseSettings, questionCount: 1 });
    game.reveal();
    game.end();

    const aliceRow = game
      .getPublicState()
      .leaderboard.find((row) => row.nickname === 'Alice');
    expect(aliceRow?.score).toBe(0);
    expect(aliceRow?.stats).toMatchObject({ correct: 0, unanswered: 1 });
  });

  it('ignores a repeat press in the lobby and refuses mid-game', () => {
    game.addPlayer('Alice');
    game.resetToLobby();
    expect(game.phase).toBe('lobby');
    startGame(game, baseSettings);
    expect(() => game.resetToLobby()).toThrow('The game has not ended yet.');
    expect(game.phase).toBe('question');
  });
});

describe('GameManager streaks', () => {
  let clock: number;
  let game: GameManager;

  beforeEach(() => {
    clock = 1000;
    game = new GameManager({
      code: 'ABCD',
      questionPool: makePool(),
      now: () => clock,
    });
  });

  function playQuestion(playerId: string, correct: boolean): void {
    game.submitAnswer(
      playerId,
      correct ? correctOptionIndex(game) : wrongOptionIndex(game),
    );
    game.reveal();
  }

  it('counts correct answers in a row and resets on a miss', () => {
    const alice = game.addPlayer('Alice');
    startGame(game, baseSettings);

    playQuestion(alice, true);
    expect(game.getAnswerResult(alice).streak).toBe(1);
    game.advance();
    game.advance();
    playQuestion(alice, true);
    expect(game.getPublicState().leaderboard[0].streak).toBe(2);
    game.advance();
    game.advance();
    playQuestion(alice, false);
    expect(game.getAnswerResult(alice).streak).toBe(0);

    game.advance();
    game.advance();
    expect(game.phase).toBe('ended');
    expect(game.getPublicState().leaderboard[0].stats?.bestStreak).toBe(2);
  });

  it('starts every player at zero after Play again', () => {
    const alice = game.addPlayer('Alice');
    startGame(game, { ...baseSettings, questionCount: 1 });
    playQuestion(alice, true);
    game.end();
    game.resetToLobby();

    const row = game.getPublicState().leaderboard[0];
    expect(row.streak).toBe(0);
    startGame(game, { ...baseSettings, questionCount: 1 });
    game.reveal();
    game.end();
    expect(game.getPublicState().leaderboard[0].stats?.bestStreak).toBe(0);
  });
});

describe('GameManager question memory', () => {
  let game: GameManager;

  beforeEach(() => {
    game = new GameManager({ code: 'ABCD', questionPool: makePool() });
    game.addPlayer('Alice');
  });

  function playRound(questionCount: number): string[] {
    startGame(game, { ...baseSettings, questionCount });
    const ids: string[] = [];
    for (;;) {
      const question = game.getPublicState().currentQuestion;
      if (question && game.phase === 'question') ids.push(question.id);
      game.advance();
      if (game.phase === 'ended') break;
    }
    game.resetToLobby();
    return ids;
  }

  it('does not repeat questions from an earlier round in the same room', () => {
    const first = playRound(2);
    const second = playRound(1);
    expect(first).toHaveLength(2);
    expect(first).not.toContain(second[0]);
  });

  it('starts over once there are not enough new questions left', () => {
    playRound(2);
    const second = playRound(2);
    expect(second).toHaveLength(2);
    const third = playRound(3);
    expect(new Set(third).size).toBe(3);
  });
});

describe('GameManager category intro', () => {
  let clock: number;
  let game: GameManager;

  beforeEach(() => {
    clock = 1000;
    game = new GameManager({
      code: 'ABCD',
      questionPool: makePool(),
      now: () => clock,
      introMs: 2000,
    });
  });

  it('shows only the category before each question opens', () => {
    const alice = game.addPlayer('Alice');
    startGame(game, { ...baseSettings, categoryIntro: true });

    const intro = game.getPublicState();
    expect(intro.phase).toBe('intro');
    expect(intro.currentQuestion).toBeNull();
    expect(intro.upcoming).toEqual({
      category: expect.any(String),
      number: 1,
      total: 3,
    });
    expect(intro.endsAt).toBe(3000);
    expect(game.submitAnswer(alice, 0).accepted).toBe(false);

    clock = 3000;
    game.startQuestion();
    const question = game.getPublicState();
    expect(question.phase).toBe('question');
    expect(question.upcoming).toBeNull();
    expect(question.currentQuestion?.category).toBe(intro.upcoming?.category);
    expect(question.endsAt).toBe(3000 + 20_000);
  });

  it('goes through the intro again for the next question', () => {
    game.addPlayer('Alice');
    startGame(game, { ...baseSettings, categoryIntro: true });
    game.advance();
    expect(game.phase).toBe('question');
    game.advance();
    game.advance();
    game.advance();
    expect(game.phase).toBe('intro');
    expect(game.getPublicState().upcoming?.number).toBe(2);
  });
});

describe('GameManager anonymous votes', () => {
  it('sends only counts when names are hidden', () => {
    const game = new GameManager({ code: 'ABCD', questionPool: makePool() });
    const alice = game.addPlayer('Alice');
    const bob = game.addPlayer('Bob');
    startGame(game, { ...baseSettings, showVoters: false });
    const correct = correctOptionIndex(game);
    game.submitAnswer(alice, correct);
    game.submitAnswer(bob, correct);
    game.reveal();

    const state = game.getPublicState();
    expect(state.optionVoters).toBeNull();
    expect(state.optionCounts?.[correct]).toBe(2);
    expect(state.optionCounts?.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('sends names and counts by default', () => {
    const game = new GameManager({ code: 'ABCD', questionPool: makePool() });
    const alice = game.addPlayer('Alice');
    startGame(game, baseSettings);
    const correct = correctOptionIndex(game);
    game.submitAnswer(alice, correct);
    game.reveal();

    const state = game.getPublicState();
    expect(state.optionVoters?.[correct]).toEqual(['Alice']);
    expect(state.optionCounts?.[correct]).toBe(1);
  });
});

describe('GameManager wrong answer penalty', () => {
  let clock: number;
  let game: GameManager;

  beforeEach(() => {
    clock = 1000;
    game = new GameManager({
      code: 'ABCD',
      questionPool: makePool(),
      now: () => clock,
    });
  });

  it('takes points for a wrong answer but never goes below zero', () => {
    const alice = game.addPlayer('Alice');
    const bob = game.addPlayer('Bob');
    startGame(game, { ...baseSettings, wrongAnswerPenalty: true });

    game.submitAnswer(alice, correctOptionIndex(game));
    game.submitAnswer(bob, wrongOptionIndex(game));
    game.reveal();
    const aliceScore = game.getAnswerResult(alice).totalScore;
    expect(game.getAnswerResult(bob).pointsAwarded).toBe(0);
    expect(game.getAnswerResult(bob).totalScore).toBe(0);

    game.advance();
    game.advance();
    game.submitAnswer(alice, wrongOptionIndex(game));
    game.reveal();
    expect(game.getAnswerResult(alice).pointsAwarded).toBe(-250);
    expect(game.getAnswerResult(alice).totalScore).toBe(aliceScore - 250);
  });

  it('costs nothing to skip a question', () => {
    const alice = game.addPlayer('Alice');
    startGame(game, { ...baseSettings, wrongAnswerPenalty: true });
    game.submitAnswer(alice, correctOptionIndex(game));
    game.reveal();
    const score = game.getAnswerResult(alice).totalScore;

    game.advance();
    game.advance();
    game.reveal();
    expect(game.getAnswerResult(alice).pointsAwarded).toBe(0);
    expect(game.getAnswerResult(alice).totalScore).toBe(score);
  });

  it('is off by default', () => {
    const alice = game.addPlayer('Alice');
    game.addPlayer('Bob');
    startGame(game, baseSettings);
    game.submitAnswer(alice, correctOptionIndex(game));
    game.reveal();
    game.advance();
    game.advance();
    game.submitAnswer(alice, wrongOptionIndex(game));
    game.reveal();
    expect(game.getAnswerResult(alice).pointsAwarded).toBe(0);
  });
});

describe('GameManager settings from older clients', () => {
  it('uses the defaults for switches that are missing', () => {
    const game = new GameManager({ code: 'ABCD', questionPool: makePool() });
    game.addPlayer('Alice');
    const {
      categoryIntro,
      showVoters,
      wrongAnswerPenalty,
      musicQuestions,
      ...older
    } = baseSettings;
    void categoryIntro;
    void showVoters;
    void wrongAnswerPenalty;
    void musicQuestions;
    game.start(older as GameSettings);
    expect(game.getPublicState().settings).toMatchObject({
      categoryIntro: true,
      showVoters: true,
      wrongAnswerPenalty: false,
      musicQuestions: true,
    });
  });
});

describe('GameManager music questions', () => {
  function tune(id: string): Question {
    return {
      id,
      category: 'Music',
      difficulty: 'easy',
      text: 'Which tune is this?',
      options: [CORRECT_ANSWER, 'Wrong1', 'Wrong2', 'Wrong3'],
      correctIndex: 0,
      melody: { bpm: 120, notes: 'C4:1 D4:1' },
    };
  }

  function playedQuestions(game: GameManager, count: number): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const question = game.getPublicState().currentQuestion;
      if (question) ids.push(question.id);
      game.advance();
      game.advance();
      game.advance();
    }
    return ids;
  }

  const pool = (): Question[] => [
    ...Array.from({ length: 10 }, (_, i) => ({
      ...makePool()[0],
      id: `n${i}`,
    })),
    tune('t1'),
    tune('t2'),
    tune('t3'),
  ];

  it('mixes in about one tune for every five questions and sends the melody', () => {
    const game = new GameManager({ code: 'ABCD', questionPool: pool() });
    game.addPlayer('Alice');
    startGame(game, {
      ...baseSettings,
      questionCount: 10,
      musicQuestions: true,
    });

    const ids = playedQuestions(game, 10);
    expect(ids.filter((id) => id.startsWith('t'))).toHaveLength(2);
  });

  it('leaves tunes out when the setting is off', () => {
    const game = new GameManager({ code: 'ABCD', questionPool: pool() });
    game.addPlayer('Alice');
    startGame(game, {
      ...baseSettings,
      questionCount: 10,
      musicQuestions: false,
    });

    expect(playedQuestions(game, 10).some((id) => id.startsWith('t'))).toBe(
      false,
    );
  });

  it('passes the melody to the screens', () => {
    const game = new GameManager({ code: 'ABCD', questionPool: [tune('t1')] });
    game.addPlayer('Alice');
    startGame(game, {
      ...baseSettings,
      questionCount: 5,
      musicQuestions: true,
    });
    expect(game.getPublicState().currentQuestion?.melody).toEqual({
      bpm: 120,
      notes: 'C4:1 D4:1',
    });
  });
});
