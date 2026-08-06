import Cookies from 'js-cookie';

const NICKNAME_COOKIE = 'quiz.nickname';
const RETENTION_DAYS = 1;

export function readNickname(): string | null {
  return Cookies.get(NICKNAME_COOKIE) || null;
}

export function writeNickname(nickname: string): void {
  Cookies.set(NICKNAME_COOKIE, nickname, {
    expires: RETENTION_DAYS,
    path: '/',
    sameSite: 'lax',
  });
}
