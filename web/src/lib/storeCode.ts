/** 헷갈리는 0 · o · 1 · l · i를 뺀 31글자. firestore.rules의 정규식과 같아야 한다. */
export const CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
export const CODE_LENGTH = 8;
export const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

export function generateStoreCode(): string {
  const n = CODE_ALPHABET.length;
  const limit = 256 - (256 % n); // 치우침 없이 뽑기 위해 남는 값은 버린다
  let out = '';
  while (out.length < CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < limit) out += CODE_ALPHABET[b % n];
      if (out.length === CODE_LENGTH) break;
    }
  }
  return out;
}

export function storeUrl(code: string): string {
  return `${location.origin}/q/${code}`;
}
