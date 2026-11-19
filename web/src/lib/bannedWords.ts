/**
 * 나라별 대표 욕설 · 비방어 몇 개만 그대로 비교한다 (우회 표현까지 막지 않음).
 * 정상 단어 안에 들어가는 말("computadora"의 puta 등)은 넣지 않는다.
 */
export const BANNED_WORDS: Record<string, string[]> = {
  ko: ['씨발', '시발', '개새끼', '병신', '좆', '지랄', '니애미', '느금마', 'ㅅㅂ', 'ㅂㅅ'],
  en: ['fuck', 'shit', 'bitch', 'asshole', 'motherfucker', 'cunt'],
  ja: ['死ね', 'くたばれ', 'クソ野郎', 'ぶっ殺す'],
  zh: ['傻逼', '操你妈', '去死', '婊子'],
  es: ['hijo de puta', 'mierda', 'pendejo', 'cabrón', 'gilipollas'],
};

/** 금칙어를 포함하지만 정상인 단어. 검사 전에 지운다. */
const ALLOWED = ['시발점', '시발역'];

const ALL = Object.values(BANNED_WORDS)
  .flat()
  .map((w) => w.toLowerCase());

export function hasBannedWord(text: string, extra: string[] = []): boolean {
  let t = text.toLowerCase();
  for (const ok of ALLOWED) t = t.split(ok).join('');
  const words = extra.length ? ALL.concat(extra.map((w) => w.trim().toLowerCase()).filter(Boolean)) : ALL;
  return words.some((w) => t.includes(w));
}
