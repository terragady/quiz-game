import { CATEGORY_ICONS, categoryIcon } from '@quiz/shared';
import { useState } from 'react';
import type { CSSProperties } from 'react';

const ALL_CATEGORIES = Object.keys(CATEGORY_ICONS);
const SPIN_ITEMS = 14;
// Keep in sync with the reel-spin animation in index.css.
export const REEL_SPIN_SECONDS = 1.1;

// Just for show: the server has already picked the category. The spin is
// chosen once per mount; the host page keys it by question.
export function CategoryReel({ category }: { category: string }) {
  const [items] = useState(() => {
    const others = ALL_CATEGORIES.filter((name) => name !== category);
    const spin = Array.from(
      { length: SPIN_ITEMS },
      (_, index) =>
        others[(index * 5 + Math.floor(Math.random() * 3)) % others.length],
    );
    return [...spin, category];
  });

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
