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
        <span className="field-label">Categories</span>
        <p className="muted field-hint">
          {settings.categories.length === 0
            ? 'Any category'
            : `${settings.categories.length} selected`}
        </p>
        <div className="category-options" role="group" aria-label="Categories">
          {categories.map((category) => {
            const checked = settings.categories.includes(category.name);
            return (
              <label key={category.name} className="category-option">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) =>
                    update({
                      categories: e.target.checked
                        ? [...settings.categories, category.name]
                        : settings.categories.filter(
                            (name) => name !== category.name,
                          ),
                    })
                  }
                />
                <span>
                  {category.name} ({category.count})
                </span>
              </label>
            );
          })}
        </div>
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

      <div className="field field--inline">
        <input
          id="autoAdvance"
          type="checkbox"
          checked={settings.autoAdvance}
          disabled={disabled}
          onChange={(e) => update({ autoAdvance: e.target.checked })}
        />
        <label htmlFor="autoAdvance">
          Advance automatically (reveal → leaderboard → next)
        </label>
      </div>

      {settings.autoAdvance && (
        <>
          <div className="field">
            <label htmlFor="revealSeconds">Seconds on answer reveal</label>
            <input
              id="revealSeconds"
              className="input"
              type="number"
              min={SETTINGS_LIMITS.minRevealSeconds}
              max={SETTINGS_LIMITS.maxRevealSeconds}
              value={settings.revealSeconds}
              disabled={disabled}
              onChange={(e) =>
                update({ revealSeconds: Number(e.target.value) })
              }
            />
          </div>

          <div className="field">
            <label htmlFor="leaderboardSeconds">Seconds on leaderboard</label>
            <input
              id="leaderboardSeconds"
              className="input"
              type="number"
              min={SETTINGS_LIMITS.minLeaderboardSeconds}
              max={SETTINGS_LIMITS.maxLeaderboardSeconds}
              value={settings.leaderboardSeconds}
              disabled={disabled}
              onChange={(e) =>
                update({ leaderboardSeconds: Number(e.target.value) })
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
