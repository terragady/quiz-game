import {
  DEFAULT_SETTINGS,
  SETTINGS_LIMITS,
  WRONG_ANSWER_PENALTY,
} from '@quiz/shared';
import type { Difficulty, GameSettings } from '@quiz/shared';

import type { SettingsErrors } from '../settingsValidation.js';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

const NO_ERRORS: SettingsErrors = {};

function NumberField({
  id,
  label,
  value,
  min,
  max,
  disabled,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  error?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        type="number"
        min={min}
        max={max}
        value={Number.isNaN(value) ? '' : value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        onChange={(e) =>
          onChange(e.target.value === '' ? NaN : Number(e.target.value))
        }
      />
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

function CheckboxField({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="field field--inline">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

export function SettingsForm({
  settings,
  errors = NO_ERRORS,
  disabled = false,
  onChange,
}: {
  settings: GameSettings;
  errors?: SettingsErrors;
  disabled?: boolean;
  onChange: (settings: GameSettings) => void;
}) {
  const update = (patch: Partial<GameSettings>) =>
    onChange({ ...settings, ...patch });

  return (
    <div>
      <NumberField
        id="questionCount"
        label="Number of questions"
        value={settings.questionCount}
        min={SETTINGS_LIMITS.minQuestionCount}
        max={SETTINGS_LIMITS.maxQuestionCount}
        disabled={disabled}
        error={errors.questionCount}
        onChange={(value) => update({ questionCount: value })}
      />

      <NumberField
        id="secondsPerQuestion"
        label="Seconds per question"
        value={settings.secondsPerQuestion}
        min={SETTINGS_LIMITS.minSecondsPerQuestion}
        max={SETTINGS_LIMITS.maxSecondsPerQuestion}
        disabled={disabled}
        error={errors.secondsPerQuestion}
        onChange={(value) => update({ secondsPerQuestion: value })}
      />

      <div className="field">
        <label htmlFor="difficulty">Difficulty</label>
        <select
          id="difficulty"
          className="select"
          value={settings.difficulty ?? ''}
          disabled={disabled}
          onChange={(e) =>
            update({
              difficulty: (e.target.value || null) as Difficulty | null,
            })
          }
        >
          <option value="">Any difficulty</option>
          {DIFFICULTIES.map((difficulty) => (
            <option key={difficulty} value={difficulty}>
              {difficulty}
            </option>
          ))}
        </select>
      </div>

      <CheckboxField
        id="categoryIntro"
        label="Show the category before each question"
        checked={settings.categoryIntro}
        disabled={disabled}
        onChange={(categoryIntro) => update({ categoryIntro })}
      />

      <CheckboxField
        id="musicQuestions"
        label="Include name-that-tune questions"
        checked={settings.musicQuestions}
        disabled={disabled}
        onChange={(musicQuestions) => update({ musicQuestions })}
      />

      <CheckboxField
        id="showVoters"
        label="Show who picked which answer"
        checked={settings.showVoters}
        disabled={disabled}
        onChange={(showVoters) => update({ showVoters })}
      />

      <CheckboxField
        id="wrongAnswerPenalty"
        label={`Wrong answers cost ${WRONG_ANSWER_PENALTY} points`}
        checked={settings.wrongAnswerPenalty}
        disabled={disabled}
        onChange={(wrongAnswerPenalty) => update({ wrongAnswerPenalty })}
      />

      <div className="field field--inline">
        <input
          id="autoAdvance"
          type="checkbox"
          checked={settings.autoAdvance}
          disabled={disabled}
          onChange={(e) => {
            const autoAdvance = e.target.checked;
            update(
              autoAdvance
                ? { autoAdvance }
                : {
                    autoAdvance,
                    revealSeconds: Number.isNaN(settings.revealSeconds)
                      ? DEFAULT_SETTINGS.revealSeconds
                      : settings.revealSeconds,
                    leaderboardSeconds: Number.isNaN(
                      settings.leaderboardSeconds,
                    )
                      ? DEFAULT_SETTINGS.leaderboardSeconds
                      : settings.leaderboardSeconds,
                  },
            );
          }}
        />
        <label htmlFor="autoAdvance">
          Advance automatically (reveal → leaderboard → next)
        </label>
      </div>

      {settings.autoAdvance && (
        <>
          <NumberField
            id="revealSeconds"
            label="Seconds on answer reveal"
            value={settings.revealSeconds}
            min={SETTINGS_LIMITS.minRevealSeconds}
            max={SETTINGS_LIMITS.maxRevealSeconds}
            disabled={disabled}
            error={errors.revealSeconds}
            onChange={(value) => update({ revealSeconds: value })}
          />

          <NumberField
            id="leaderboardSeconds"
            label="Seconds on leaderboard"
            value={settings.leaderboardSeconds}
            min={SETTINGS_LIMITS.minLeaderboardSeconds}
            max={SETTINGS_LIMITS.maxLeaderboardSeconds}
            disabled={disabled}
            error={errors.leaderboardSeconds}
            onChange={(value) => update({ leaderboardSeconds: value })}
          />
        </>
      )}
    </div>
  );
}
