import { GAME_CODE_LENGTH } from '@quiz/shared';

// Excludes visually ambiguous characters (I, O, 0, 1).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Generate an uppercase join code from an unambiguous alphabet. */
export function generateGameCode(length: number = GAME_CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
