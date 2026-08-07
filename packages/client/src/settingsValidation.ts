import { SETTINGS_LIMITS, type GameSettings } from '@quiz/shared';

export interface SettingsErrors {
  questionCount?: string;
  secondsPerQuestion?: string;
  revealSeconds?: string;
  leaderboardSeconds?: string;
}

function rangeError(
  value: number,
  min: number,
  max: number,
  label: string,
): string | undefined {
  if (!Number.isInteger(value) || value < min || value > max) {
    return `${label} must be between ${min} and ${max}.`;
  }
  return undefined;
}

export function getSettingsErrors(settings: GameSettings): SettingsErrors {
  const limits = SETTINGS_LIMITS;
  const errors: SettingsErrors = {};

  const questionCount = rangeError(
    settings.questionCount,
    limits.minQuestionCount,
    limits.maxQuestionCount,
    'Number of questions',
  );
  if (questionCount) errors.questionCount = questionCount;

  const secondsPerQuestion = rangeError(
    settings.secondsPerQuestion,
    limits.minSecondsPerQuestion,
    limits.maxSecondsPerQuestion,
    'Seconds per question',
  );
  if (secondsPerQuestion) errors.secondsPerQuestion = secondsPerQuestion;

  if (settings.autoAdvance) {
    const revealSeconds = rangeError(
      settings.revealSeconds,
      limits.minRevealSeconds,
      limits.maxRevealSeconds,
      'Seconds on answer reveal',
    );
    if (revealSeconds) errors.revealSeconds = revealSeconds;

    const leaderboardSeconds = rangeError(
      settings.leaderboardSeconds,
      limits.minLeaderboardSeconds,
      limits.maxLeaderboardSeconds,
      'Seconds on leaderboard',
    );
    if (leaderboardSeconds) errors.leaderboardSeconds = leaderboardSeconds;
  }

  return errors;
}

export function hasSettingsErrors(errors: SettingsErrors): boolean {
  return Object.keys(errors).length > 0;
}
