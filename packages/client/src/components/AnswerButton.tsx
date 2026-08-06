const LETTERS = ['A', 'B', 'C', 'D'];
const MAX_VISIBLE_VOTERS = 6;

export function AnswerButton({
  index,
  label,
  onSelect,
  disabled = false,
  selected = false,
  correct,
  voters,
  hideLetter = false,
}: {
  index: number;
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
  selected?: boolean;
  correct?: boolean;
  voters?: string[];
  hideLetter?: boolean;
}) {
  const classes = ['answer', `answer--${index}`];
  if (selected) classes.push('answer--selected');
  if (correct === true) classes.push('answer--correct');
  if (correct === false && !selected) classes.push('answer--dim');
  if (hideLetter) classes.push('answer--no-letter');

  const visibleVoters = voters?.slice(0, MAX_VISIBLE_VOTERS) ?? [];
  const overflow = (voters?.length ?? 0) - visibleVoters.length;

  return (
    <button
      type="button"
      className={classes.join(' ')}
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
    >
      {!hideLetter && (
        <span className="answer__letter" aria-hidden="true">
          {LETTERS[index] ?? index + 1}
        </span>
      )}
      <span className="answer__label">{label}</span>
      {voters !== undefined && (
        <span className="answer__voters">
          {visibleVoters.map((nickname, voterIndex) => (
            <span key={voterIndex} className="answer__voter">
              {nickname}
            </span>
          ))}
          {overflow > 0 && (
            <span className="answer__voter answer__voter--more">
              +{overflow} more
            </span>
          )}
        </span>
      )}
    </button>
  );
}
