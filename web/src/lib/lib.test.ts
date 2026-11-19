import { describe, expect, it } from 'vitest';
import { hasBannedWord } from './bannedWords';
import { CODE_RE, generateStoreCode } from './storeCode';
import { checkEmail, checkPassword, checkQuestion, checkStoreName, passwordStrength, tidyText } from './validation';

describe('금칙어', () => {
  it('나라별 단어를 잡는다', () => {
    expect(hasBannedWord('진짜 씨발 별로')).toBe(true);
    expect(hasBannedWord('This is SHIT')).toBe(true);
    expect(hasBannedWord('お前死ね')).toBe(true);
  });
  it('정상 문장 · 예외 단어는 통과', () => {
    expect(hasBannedWord('디카페인 원두도 파시나요?')).toBe(false);
    expect(hasBannedWord('시발점이 어디예요')).toBe(false);
    expect(hasBannedWord('la computadora no funciona')).toBe(false);
  });
  it('가게별 금지어', () => {
    expect(hasBannedWord('옆집 경쟁카페가 낫네', ['경쟁카페'])).toBe(true);
    expect(hasBannedWord('맛있어요', ['경쟁카페', ' '])).toBe(false);
  });
});

describe('입력 검증', () => {
  it('이메일', () => {
    expect(checkEmail('')).toBe('errors.required');
    expect(checkEmail('abc')).toBe('errors.emailInvalid');
    expect(checkEmail('a@b.co')).toBeNull();
  });
  it('비밀번호: 8자 + 영문 + 숫자, 흔한 비밀번호 차단', () => {
    expect(checkPassword('abc123')).toBe('errors.passwordShort');
    expect(checkPassword('abcdefgh')).toBe('errors.passwordMix');
    expect(checkPassword('12345678')).toBe('errors.passwordMix');
    expect(checkPassword('Password1')).toBe('errors.passwordCommon');
    expect(checkPassword('coffee2024')).toBeNull();
  });
  it('비밀번호 강도', () => {
    expect(passwordStrength('short')).toBe(0);
    expect(passwordStrength('coffee2024')).toBe(1);
    expect(passwordStrength('coffee2024!')).toBe(2);
    expect(passwordStrength('coffee-roast-2024!')).toBe(3);
  });
  it('상호명', () => {
    expect(checkStoreName('  ')).toBe('errors.required');
    expect(checkStoreName('가'.repeat(21))).toBe('errors.tooLong');
    expect(checkStoreName('가'.repeat(20))).toBeNull();
    expect(checkStoreName('연남동 로스터리')).toBeNull();
  });
  it('질문 2~500자', () => {
    expect(checkQuestion('아')).toBe('errors.questionShort');
    expect(checkQuestion('가'.repeat(501))).toBe('errors.tooLong');
    expect(checkQuestion('주차 돼요?')).toBeNull();
  });
  it('줄바꿈 정리', () => {
    expect(tidyText('  a\n\n\n\nb  ')).toBe('a\n\nb');
  });
});

describe('가게 코드', () => {
  it('8자리, 규칙 정규식과 일치, 매번 다름', () => {
    const codes = new Set(Array.from({ length: 1000 }, generateStoreCode));
    expect(codes.size).toBe(1000);
    for (const c of codes) expect(c).toMatch(CODE_RE);
  });
});
