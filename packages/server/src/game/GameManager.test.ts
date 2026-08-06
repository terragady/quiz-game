import { beforeEach, describe, it, expect } from 'vitest';
import { BASE_POINTS, type GameSettings, type Question } from '@quiz/shared';
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
  category: null,
  difficulty: null,
  autoAdvance: false,
  revealSeconds: 5,
  leaderboardSeconds: 8,
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
      game.start({ ...baseSettings, category: 'Nonexistent' }),
    ).toThrow(/No questions match/);
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

  it('exposes per-option answer counts only during the reveal phase', () => {
    const correct = correctOptionIndex(game);
    const incorrect = wrongOptionIndex(game);
    game.submitAnswer(fast, correct);
    game.submitAnswer(slow, correct);
    game.submitAnswer(wrong, incorrect);

    expect(game.getPublicState().optionCounts).toBeNull();

    game.reveal();

    const counts = game.getPublicState().optionCounts;
    expect(counts).not.toBeNull();
    expect(counts?.[correct]).toBe(2);
    expect(counts?.[incorrect]).toBe(1);
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
    startGame(game, { ...baseSettings, questionCount: 1, secondsPerQuestion: 20 });

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
