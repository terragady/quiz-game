const NICKNAME_COOKIE = 'quiz.nickname';
const ONE_DAY_SECONDS = 24 * 60 * 60;

export function readNickname(): string | null {
  try {
    const match = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${NICKNAME_COOKIE}=`));
    if (!match) return null;
    const value = decodeURIComponent(match.slice(NICKNAME_COOKIE.length + 1));
    return value || null;
  } catch {
    return null;
  }
}

export function writeNickname(nickname: string): void {
  try {
    document.cookie = `${NICKNAME_COOKIE}=${encodeURIComponent(
      nickname,
    )}; max-age=${ONE_DAY_SECONDS}; path=/; samesite=lax`;
  } catch {
    void 0;
  }
}
