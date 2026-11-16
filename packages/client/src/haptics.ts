// Phone buzzes for players. Browsers without vibration (iPhones) ignore them.
export const BUZZ = {
  questionOpen: 40,
  correct: [60, 40, 60],
  wrong: 250,
};

export function buzz(pattern: number | number[]): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}
