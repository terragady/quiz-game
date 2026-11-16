import { useMemo, type CSSProperties } from 'react';
import { CATEGORY_ICONS, categoryIcon } from '@quiz/shared';

const ALL_CATEGORIES = Object.keys(CATEGORY_ICONS);
const SPIN_ITEMS = 14;
// Keep in sync with the reel-spin animation in index.css.
export const REEL_SPIN_SECONDS = 1.1;

// A short slot-machine spin that lands on the next question's category.
// The category is already decided by the server; this is just for show.
export function CategoryReel({ category }: { category: string }) {
  const items = useMemo(() => {
    const others = ALL_CATEGORIES.filter((name) => name !== category);
    const spin = Array.from(
      { length: SPIN_ITEMS },
      (_, index) => others[(index * 5 + Math.floor(Math.random() * 3)) % others.length],
    );
    return [...spin, category];
  }, [category]);

  return (
    <div className="reel" aria-live="polite">
      <div
        className="reel__track"
        style={{ '--reel-steps': items.length - 1 } as CSSProperties}
        aria-hidden="true"
      >
        {items.map((name, index) => (
          <div key={index} className="reel__item">
            <span className="reel__icon">{categoryIcon(name)}</span>
            <span className="reel__name">{name}</span>
          </div>
        ))}
      </div>
      <span className="visually-hidden">Next category: {category}</span>
    </div>
  );
}
