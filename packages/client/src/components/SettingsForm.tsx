import {
  SETTINGS_LIMITS,
  type CategorySummary,
  type Difficulty,
  type GameSettings,
} from '@quiz/shared';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export function SettingsForm({
  settings,
  categories,
  disabled = false,
  onChange,
}: {
  settings: GameSettings;
  categories: CategorySummary[];
  disabled?: boolean;
  onChange: (settings: GameSettings) => void;
}) {
  const update = (patch: Partial<GameSettings>) =>
    onChange({ ...settings, ...patch });

  return (
    <div>
      <div className="field">
        <label htmlFor="questionCount">Number of questions</label>
        <input
          id="questionCount"
          className="input"
          type="number"
          min={SETTINGS_LIMITS.minQuestionCount}
          max={SETTINGS_LIMITS.maxQuestionCount}
          value={settings.questionCount}
          disabled={disabled}
          onChange={(e) =>
            update({ questionCount: Number(e.target.value) })
          }
        />
      </div>

      <div className="field">
        <label htmlFor="secondsPerQuestion">Seconds per question</label>
        <input
          id="secondsPerQuestion"
          className="input"
          type="number"
          min={SETTINGS_LIMITS.minSecondsPerQuestion}
          max={SETTINGS_LIMITS.maxSecondsPerQuestion}
          value={settings.secondsPerQuestion}
          disabled={disabled}
          onChange={(e) =>
            update({ secondsPerQuestion: Number(e.target.value) })
          }
        />
      </div>

      <div className="field">
        <label htmlFor="category">Category</label>
        <select
          id="category"
          className="select"
          value={settings.category ?? ''}
          disabled={disabled}
          onChange={(e) =>
            update({ category: e.target.value || null })
          }
        >
          <option value="">Any category</option>
          {categories.map((category) => (
            <option key={category.name} value={category.name}>
              {category.name} ({category.count})
            </option>
          ))}
        </select>
      </div>

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
    </div>
  );
}
