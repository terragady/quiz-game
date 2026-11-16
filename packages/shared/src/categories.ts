// The categories questions are sorted into, with the icon shown for each.
// Raw categories from the question sources are mapped onto these when the
// question pool is built.
export const CATEGORY_ICONS: Record<string, string> = {
  Geography: '🌍',
  History: '🏛️',
  'Science & Nature': '🔬',
  Technology: '💻',
  Games: '🎮',
  'Film & TV': '🎬',
  Music: '🎵',
  'Arts & Literature': '📚',
  'Society & Culture': '🗣️',
  'Food & Drink': '🍕',
  'Sport & Leisure': '⚽',
  'General Knowledge': '💡',
  Poland: '🇵🇱',
  Norway: '🇳🇴',
};

export function categoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? '❓';
}
