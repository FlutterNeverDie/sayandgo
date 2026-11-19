import i18n, { currentLang } from '../i18n';

/** "3분 전" 같은 상대 시간. 일주일이 넘으면 날짜로. */
export function relativeTime(date: Date | null): string {
  if (!date) return i18n.t('time.justNow');
  const diff = (date.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return i18n.t('time.justNow');
  const rtf = new Intl.RelativeTimeFormat(currentLang(), { numeric: 'auto' });
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day');
  return new Intl.DateTimeFormat(currentLang(), { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

/** Firebase 오류 코드 → i18n 키 */
export function errorKey(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'errors.emailInUse';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'errors.wrongLogin';
    case 'auth/too-many-requests':
      return 'errors.tooMany';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'errors.network';
    default:
      return 'errors.generic';
  }
}
