import { describe, expect, it } from 'vitest';
import { CATEGORY_ICONS } from '@quiz/shared';
import { tidyCategory } from './categories.js';

describe('tidyCategory', () => {
  it('maps source categories onto the shared set', () => {
    expect(tidyCategory('Entertainment: Film')).toBe('Film & TV');
    expect(tidyCategory('Film And Tv')).toBe('Film & TV');
    expect(tidyCategory('Science: Computers')).toBe('Technology');
    expect(tidyCategory('Poland')).toBe('Poland');
  });

  it('falls back to General Knowledge for unknown categories', () => {
    expect(tidyCategory('Something New')).toBe('General Knowledge');
  });

  it('only produces categories that have an icon', () => {
    for (const raw of ['Flags', 'Mythology', 'Sports', 'Celebrities', 'Unknown']) {
      expect(CATEGORY_ICONS[tidyCategory(raw)]).toBeDefined();
    }
  });
});
