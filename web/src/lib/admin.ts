import { createUserWithEmailAndPassword, sendEmailVerification, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { db, openSecondary } from './firebase';
import { CODE_ALPHABET, CODE_RE, generateStoreCode } from './storeCode';
import { verifyActionSettings, withContinueFallback } from './stores';
import { TERMS_VERSION, type StoreCategory } from './types';

/** 운영자 계정 (firestore.rules의 isAdmin과 같아야 한다) */
export const ADMIN_EMAIL = 'oasa741@gmail.com';
export const isAdminUser = (u: User | null) => !!u && u.emailVerified && u.email === ADMIN_EMAIL;

export interface SetupInput {
  storeName: string;
  category: StoreCategory;
  tone: string;
  intro: string;
  /** 미리 뽑아 둔 빈 QR 카드 번호. 있으면 이 번호가 가게 코드가 된다 */
  card?: string | null;
}

/** 운영자가 현장에서 세팅한 가게 (운영자만 보는 목록) */
export interface AdminStore {
  code: string;
  storeName: string;
  category: StoreCategory;
  tone: string;
  /** account: 사장님 이메일로 계정까지 만듦 · claim: 연결 코드로 나중에 넘겨받음 */
  mode: 'account' | 'claim';
  ownerEmail: string | null;
  claimCode: string | null;
  createdAt: Date | null;
}

function randomFrom(alphabet: string, n: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** 임시 비밀번호: 영문 + 숫자 10자 (가입 규칙: 8자 이상, 영문 · 숫자 섞기) */
export function tempPassword() {
  return `${randomFrom('abcdefghjkmnpqrstuvwxyz', 5)}${randomFrom('23456789', 5)}`;
}

/** 연결 토큰: 가게 코드 + 연결 코드 8자 (예: kjb9f5ep-ab23cd45) */
export const claimToken = (code: string, claim: string) => `${code}-${claim}`;
export function parseClaimToken(token: string): { code: string; claim: string } | null {
  const m = token.trim().toLowerCase().match(new RegExp(`^([${CODE_ALPHABET}]{8})-?([${CODE_ALPHABET}]{8})$`));
  return m ? { code: m[1], claim: m[2] } : null;
}
export const claimUrl = (code: string, claim: string) => `${location.origin}/signup?claim=${claimToken(code, claim)}`;

const storeDoc = (fs: Firestore, code: string) => doc(fs, 'stores', code);

function storeFields(input: SetupInput, ownerUid: string | null, status: 'pending' | 'active') {
  return {
    storeName: input.storeName.trim(),
    intro: input.intro.trim(),
    category: input.category,
    tone: input.tone,
    ownerUid,
    lang: 'ko',
    status,
    acceptingQuestions: true,
    blockedWords: [],
    createdAt: serverTimestamp(),
  };
}

/** 코드가 겹치면 새 코드로 다시 (최대 3번). 카드 번호가 있으면 그 번호 하나만 쓴다 */
async function withFreshCode<T>(make: (code: string) => Promise<T>, card?: string | null): Promise<T> {
  if (card) return make(card);
  for (let attempt = 0; ; attempt++) {
    try {
      return await make(generateStoreCode());
    } catch (e) {
      if (attempt >= 2) throw e;
    }
  }
}

/**
 * 방법 1: 사장님 이메일로 계정 + 가게를 만들고, 운영자가 바로 열어 둔다.
 * 사장님은 받은 임시 비밀번호로 로그인하고, 메일 인증만 하면 피드백을 볼 수 있다.
 */
export async function setupWithAccount(input: SetupInput & { email: string }) {
  if (input.card) await assertCardFree(input.card);
  const password = tempPassword();
  const second = openSecondary();
  try {
    second.auth.languageCode = 'ko';
    const { user } = await createUserWithEmailAndPassword(second.auth, input.email.trim(), password);
    const code = await withFreshCode(async (code) => {
      const b = writeBatch(second.db);
      b.set(storeDoc(second.db, code), storeFields(input, user.uid, 'pending'));
      b.set(doc(second.db, 'users', user.uid), {
        storeCode: code,
        uiLang: 'ko',
        agreed: { terms: TERMS_VERSION, privacy: TERMS_VERSION, age14: true },
        createdAt: serverTimestamp(),
      });
      await b.commit();
      return code;
    }, input.card);
    await withContinueFallback((withUrl) => sendEmailVerification(user, withUrl ? verifyActionSettings() : undefined)).catch(() => undefined);
    await signOut(second.auth);

    // 운영자 연결로: 가게를 바로 열고, 세팅 목록에 남긴다
    const b = writeBatch(db);
    b.update(storeDoc(db, code), { status: 'active' });
    b.set(doc(db, 'adminStores', code), {
      storeName: input.storeName.trim(),
      category: input.category,
      tone: input.tone,
      mode: 'account',
      ownerEmail: input.email.trim(),
      claimCode: null,
      createdAt: serverTimestamp(),
    });
    if (input.card) b.update(doc(db, 'cards', code), { used: true });
    await b.commit();
    return { code, password };
  } finally {
    await second.close().catch(() => undefined);
  }
}

/** 방법 2: 주인 없는 가게를 바로 열고, 사장님이 나중에 가입하며 넘겨받을 연결 코드를 만든다 */
export async function setupWithClaim(input: SetupInput) {
  if (input.card) await assertCardFree(input.card);
  const claim = randomFrom(CODE_ALPHABET, 8);
  const code = await withFreshCode(async (code) => {
    const b = writeBatch(db);
    b.set(storeDoc(db, code), storeFields(input, null, 'active'));
    b.set(doc(db, 'stores', code, 'private', 'claim'), { code: claim });
    b.set(doc(db, 'adminStores', code), {
      storeName: input.storeName.trim(),
      category: input.category,
      tone: input.tone,
      mode: 'claim',
      ownerEmail: null,
      claimCode: claim,
      createdAt: serverTimestamp(),
    });
    if (input.card) b.update(doc(db, 'cards', code), { used: true });
    await b.commit();
    return code;
  }, input.card);
  return { code, claim };
}

export async function listAdminStores(): Promise<AdminStore[]> {
  const snap = await getDocs(query(collection(db, 'adminStores'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => {
    const x = d.data({ serverTimestamps: 'estimate' });
    return {
      code: d.id,
      storeName: x.storeName,
      category: x.category,
      tone: x.tone,
      mode: x.mode,
      ownerEmail: x.ownerEmail ?? null,
      claimCode: x.claimCode ?? null,
      createdAt: x.createdAt?.toDate?.() ?? null,
    };
  });
}

/** 받은 피드백 수 (운영자는 숨김 · 답변 전 글까지 셀 수 있다) */
export async function feedbackCount(code: string) {
  const snap = await getCountFromServer(collection(db, 'stores', code, 'questions'));
  return snap.data().count;
}

/* ---------- 빈 QR 카드: 집에서 미리 뽑아 두고, 매장에서 상호를 연결한다 ---------- */

export interface BlankCard {
  code: string;
  createdAt: Date | null;
}

/** 카드 번호 표기: 4자씩 끊어 읽기 쉽게 (abcd efgh) */
export const cardLabel = (code: string) => `${code.slice(0, 4)} ${code.slice(4)}`;

/** 손으로 친 카드 번호 / 찍은 링크에서 카드 번호만 뽑는다 */
export function parseCard(text: string): string | null {
  const t = text.trim().toLowerCase();
  const fromUrl = t.match(/\/q\/([a-z0-9]{8})/);
  const raw = fromUrl ? fromUrl[1] : t.replace(/[^a-z0-9]/g, '');
  return CODE_RE.test(raw) ? raw : null;
}

class CardError extends Error {
  code: 'card/unknown' | 'card/used';
  constructor(code: 'card/unknown' | 'card/used') {
    super(code);
    this.code = code;
  }
}

/** 연결 전에: 내가 만든 카드인지, 이미 매장에 쓰였는지 */
async function assertCardFree(card: string) {
  const [c, st] = await Promise.all([getDoc(doc(db, 'cards', card)), getDoc(storeDoc(db, card))]);
  if (!c.exists()) throw new CardError('card/unknown');
  if (c.data().used || st.exists()) throw new CardError('card/used');
}

/** 빈 카드 n장 만들기 (가게 코드를 미리 잡아 둔다) */
export async function createCards(n: number): Promise<string[]> {
  const codes = new Set<string>();
  while (codes.size < n) codes.add(generateStoreCode());
  const b = writeBatch(db);
  for (const code of codes) b.set(doc(db, 'cards', code), { used: false, createdAt: serverTimestamp() });
  await b.commit();
  return [...codes];
}

/** 아직 매장에 연결하지 않은 카드 (새로 만든 것부터) */
export async function listBlankCards(): Promise<BlankCard[]> {
  // used 하나만 조건으로 걸고 정렬은 여기서 (운영 DB에 복합 색인을 따로 만들지 않으려고)
  const snap = await getDocs(query(collection(db, 'cards'), where('used', '==', false)));
  return snap.docs
    .map((d) => ({ code: d.id, createdAt: d.data({ serverTimestamps: 'estimate' }).createdAt?.toDate?.() ?? null }))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

/** 손님이 연결 전 카드를 찍었을 때: 준비 중인 카드인지 (누구나 한 장씩은 볼 수 있다) */
export async function isPendingCard(code: string) {
  const snap = await getDoc(doc(db, 'cards', code));
  return snap.exists() && snap.data().used === false;
}
