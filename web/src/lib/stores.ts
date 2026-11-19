import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc, writeBatch, type DocumentSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { generateStoreCode } from './storeCode';
import { LEGACY_TONES, PRESET_TONES } from '../components/ui/StoreIcon';
import { TERMS_VERSION, type Store, type StoreCategory } from './types';

const toDate = (v: unknown): Date | null =>
  v && typeof (v as { toDate?: () => Date }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : null;

export function toStore(snap: DocumentSnapshot): Store | null {
  if (!snap.exists()) return null;
  const d = snap.data({ serverTimestamps: 'estimate' });
  return {
    code: snap.id,
    storeName: d.storeName,
    intro: d.intro ?? '',
    category: d.category ?? 'other',
    tone: LEGACY_TONES[d.tone] ?? d.tone ?? PRESET_TONES[0],
    ownerUid: d.ownerUid,
    lang: d.lang,
    status: d.status,
    acceptingQuestions: d.acceptingQuestions,
    blockedWords: d.blockedWords ?? [],
    createdAt: toDate(d.createdAt),
  };
}

export async function getStore(code: string): Promise<Store | null> {
  return toStore(await getDoc(doc(db, 'stores', code)));
}

export async function getMyStoreCode(uid: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data().storeCode as string) : null;
}

export function verifyActionSettings() {
  return { url: `${location.origin}/verify` };
}

/** 돌아올 주소가 Firebase 허용 도메인에 없으면(auth/unauthorized-continue-uri) 주소 없이 다시 보낸다 */
export async function withContinueFallback(send: (withUrl: boolean) => Promise<void>) {
  try {
    await send(true);
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code.includes('unauthorized-continue-uri') || code.includes('invalid-continue-uri')) await send(false);
    else throw e;
  }
}

/** 가입: Auth 계정 → 가게 + users 한 배치 → 인증 메일. 가게 생성이 끝내 실패하면 계정을 지운다. */
export async function signUp(input: { email: string; password: string; storeName: string; lang: string; category: StoreCategory }) {
  auth.languageCode = input.lang;
  const { user } = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
  let code = '';
  try {
    for (let attempt = 0; ; attempt++) {
      code = generateStoreCode();
      try {
        await createStore(user, code, input.storeName.trim(), input.lang, input.category);
        break;
      } catch (e) {
        if (attempt >= 2) throw e; // 코드 충돌이면 새 코드로 재시도
      }
    }
  } catch (e) {
    await deleteUser(user).catch(() => undefined);
    throw e;
  }
  // 실패해도 /verify에서 다시 보낼 수 있다
  await withContinueFallback((withUrl) => sendEmailVerification(user, withUrl ? verifyActionSettings() : undefined)).catch(() => undefined);
  return code;
}

async function createStore(user: User, code: string, storeName: string, lang: string, category: StoreCategory) {
  const b = writeBatch(db);
  b.set(doc(db, 'stores', code), {
    storeName,
    intro: '',
    category,
    tone: PRESET_TONES[0],
    ownerUid: user.uid,
    lang,
    status: 'pending',
    acceptingQuestions: true,
    blockedWords: [],
    createdAt: serverTimestamp(),
  });
  b.set(doc(db, 'users', user.uid), {
    storeCode: code,
    uiLang: lang,
    agreed: { terms: TERMS_VERSION, privacy: TERMS_VERSION, age14: true },
    createdAt: serverTimestamp(),
  });
  await b.commit();
}

/** 이메일 인증 후: 토큰을 새로 받아(email_verified 반영) 가게를 active로 */
export async function activateStore(user: User, code: string) {
  await user.getIdToken(true);
  await updateDoc(doc(db, 'stores', code), { status: 'active' });
}

export type StoreSettings = Pick<Store, 'storeName' | 'intro' | 'category' | 'tone' | 'acceptingQuestions' | 'blockedWords'>;

export async function updateStore(code: string, patch: Partial<StoreSettings>) {
  await updateDoc(doc(db, 'stores', code), patch);
}
