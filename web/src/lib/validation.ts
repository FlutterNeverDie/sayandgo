import { hasBannedWord } from './bannedWords';

/** 보안 규칙(firestore.rules)과 같은 숫자를 쓴다. */
export const LIMITS = {
  storeName: 20,
  intro: 30,
  questionMin: 2,
  questionMax: 500,
  answer: 1000,
  passwordMin: 8,
  blockedWords: 30,
  blockedWordLength: 20,
  reportDetail: 300,
} as const;

/** 반환값은 i18n 키 (errors.*). 문제가 없으면 null. */
export type FieldError = string | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function checkEmail(v: string): FieldError {
  const s = v.trim();
  if (!s) return 'errors.required';
  if (!EMAIL_RE.test(s)) return 'errors.emailInvalid';
  return null;
}

const COMMON_PASSWORDS = ['12345678', '123456789', '1234567890', 'password', 'password1', 'qwerty123', 'abcd1234', '11111111', 'qwer1234'];

export function checkPassword(pw: string): FieldError {
  if (!pw) return 'errors.required';
  if (pw.length < LIMITS.passwordMin) return 'errors.passwordShort';
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'errors.passwordMix';
  if (COMMON_PASSWORDS.includes(pw.toLowerCase())) return 'errors.passwordCommon';
  return null;
}

/** 0 = 약함 · 1 = 보통 · 2 = 좋음 · 3 = 아주 좋음 */
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (checkPassword(pw)) return 0;
  let score = 1;
  if (pw.length >= 12) score++;
  if (/[^a-zA-Z0-9]/.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) score++;
  return Math.min(score, 3) as 1 | 2 | 3;
}

export function checkStoreName(v: string): FieldError {
  const s = v.trim();
  if (!s) return 'errors.required';
  if (s.length > LIMITS.storeName) return 'errors.tooLong';
  if (hasBannedWord(s)) return 'errors.banned';
  return null;
}

export function checkIntro(v: string): FieldError {
  const s = v.trim();
  if (s.length > LIMITS.intro) return 'errors.tooLong';
  if (s && hasBannedWord(s)) return 'errors.banned';
  return null;
}

export function checkQuestion(v: string, storeWords: string[] = []): FieldError {
  const s = v.trim();
  if (s.length < LIMITS.questionMin) return 'errors.questionShort';
  if (s.length > LIMITS.questionMax) return 'errors.tooLong';
  if (hasBannedWord(s, storeWords)) return 'errors.banned';
  return null;
}

export function checkAnswer(v: string): FieldError {
  const s = v.trim();
  if (!s) return 'errors.required';
  if (s.length > LIMITS.answer) return 'errors.tooLong';
  return null;
}

/** 줄바꿈 3개 이상 연속은 2개로, 앞뒤 공백 제거 */
export function tidyText(v: string): string {
  return v.trim().replace(/\n{3,}/g, '\n\n');
}
