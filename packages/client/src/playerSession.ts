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
    void 0;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    void 0;
  }
}
