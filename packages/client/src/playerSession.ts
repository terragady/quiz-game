/**
 * Persisted player identity used to survive reconnects and refreshes. The
 * `playerId` doubles as a bearer token the server accepts via `playerRejoin`,
 * so a phone that drops its connection (e.g. the screen turns off) can silently
 * re-attach to the same player instead of being kicked out.
 */
export interface PlayerSession {
  code: string;
  playerId: string;
  nickname: string;
}

const SESSION_KEY = 'quiz.playerSession';

export function readSession(): PlayerSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlayerSession>;
    if (
      typeof parsed.code === 'string' &&
      typeof parsed.playerId === 'string' &&
      typeof parsed.nickname === 'string'
    ) {
      return { code: parsed.code, playerId: parsed.playerId, nickname: parsed.nickname };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeSession(session: PlayerSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore.
  }
}
