const LETTERS = ['A', 'B', 'C', 'D'];

export function AnswerButton({
  index,
  label,
  onSelect,
  disabled = false,
  selected = false,
  correct,
}: {
  index: number;
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
  selected?: boolean;
  correct?: boolean;
}) {
  const classes = ['answer', `answer--${index}`];
  if (selected) classes.push('answer--selected');
  if (correct === true) classes.push('answer--correct');
  if (correct === false && !selected) classes.push('answer--dim');

  return (
    <button
      type="button"
      className={classes.join(' ')}
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="answer__letter" aria-hidden="true">
        {LETTERS[index] ?? index + 1}
      </span>
      <span>{label}</span>
    </button>
  );
}
