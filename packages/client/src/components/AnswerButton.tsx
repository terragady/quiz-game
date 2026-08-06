const LETTERS = ['A', 'B', 'C', 'D'];

export function AnswerButton({
  index,
  label,
  onSelect,
  disabled = false,
  selected = false,
  correct,
  count,
  share,
  hideLetter = false,
}: {
  index: number;
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
  selected?: boolean;
  correct?: boolean;
  count?: number;
  share?: number;
  hideLetter?: boolean;
}) {
  const classes = ['answer', `answer--${index}`];
  if (selected) classes.push('answer--selected');
  if (correct === true) classes.push('answer--correct');
  if (correct === false && !selected) classes.push('answer--dim');
  if (hideLetter) classes.push('answer--no-letter');

  const showDistribution = share !== undefined;
  const percent = share !== undefined ? Math.round(share * 100) : 0;

  return (
    <button
      type="button"
      className={classes.join(' ')}
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
    >
      {showDistribution && (
        <span
          className="answer__fill"
          style={{ width: `${percent}%` }}
          aria-hidden="true"
        />
      )}
      {!hideLetter && (
        <span className="answer__letter" aria-hidden="true">
          {LETTERS[index] ?? index + 1}
        </span>
      )}
      <span className="answer__label">{label}</span>
      {showDistribution && (
        <span className="answer__count">
          {count ?? 0} · {percent}%
        </span>
      )}
    </button>
  );
}
