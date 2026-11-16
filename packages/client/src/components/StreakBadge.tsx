// Streaks are shown from this many correct answers in a row.
export const SHOW_STREAK_FROM = 3;

export function StreakBadge({ streak }: { streak: number }) {
  if (streak < SHOW_STREAK_FROM) {
    return null;
  }
  return (
    <span className="streak-badge" title={`${streak} correct in a row`}>
      🔥{streak}
    </span>
  );
}
