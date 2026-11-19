import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

let env: RulesTestEnvironment;

const CODE = 'abcd2345';
const OWNER = 'owner1';

const ownerToken = { email: 'o@x.com', email_verified: true, firebase: { sign_in_provider: 'password' } };
const unverifiedToken = { email: 'u@x.com', email_verified: false, firebase: { sign_in_provider: 'password' } };
const anonToken = { firebase: { sign_in_provider: 'anonymous' } };
const adminToken = { email: 'a@x.com', email_verified: true, admin: true, firebase: { sign_in_provider: 'password' } };

const owner = () => env.authenticatedContext(OWNER, ownerToken).firestore();
const anon = (uid = 'anon1') => env.authenticatedContext(uid, anonToken).firestore();
const admin = () => env.authenticatedContext('admin1', adminToken).firestore();
const guest = () => env.unauthenticatedContext().firestore();

const storeData = (ownerUid: string, status = 'active') => ({
  storeName: '연남동 로스터리',
  intro: '',
  category: 'cafe',
  tone: '#3ccfae',
  ownerUid,
  lang: 'ko',
  status,
  acceptingQuestions: true,
  showUnanswered: true,
  blockedWords: [],
  createdAt: Timestamp.now(),
});

const questionData = (over: Record<string, unknown> = {}) => ({
  body: '디카페인 원두도 파시나요?',
  lang: 'ko',
  status: 'open',
  answer: null,
  hidden: false,
  hiddenBy: null,
  reportCount: 0,
  pinned: false,
  createdAt: Timestamp.now(),
  ...over,
});

/** 손님 질문 등록: 질문 + 작성자 기록 + 쓰기 간격을 한 배치로 */
function postQuestion(db: Firestore, uid: string, qid: string, opts: { author?: boolean; throttle?: boolean } = {}) {
  const b = writeBatch(db);
  b.set(doc(db, `stores/${CODE}/questions/${qid}`), { ...questionData(), createdAt: serverTimestamp() });
  if (opts.author !== false) b.set(doc(db, `stores/${CODE}/authors/${qid}`), { uid });
  if (opts.throttle !== false) b.set(doc(db, `throttle/${uid}`), { lastPostAt: serverTimestamp() });
  return b.commit();
}

/** 손님 신고: 신고 문서 + reportCount +1 (3건째면 가림) */
function report(db: Firestore, uid: string, qid: string, nextCount: number, opts: { withDoc?: boolean; hide?: boolean } = {}) {
  const b = writeBatch(db);
  if (opts.withDoc !== false) {
    b.set(doc(db, `reports/${qid}_${uid}`), {
      targetType: 'question', storeCode: CODE, targetId: qid, reason: 'abuse', detail: '',
      reporterUid: uid, status: 'open', createdAt: serverTimestamp(),
    });
  }
  const hide = opts.hide ?? nextCount >= 3;
  b.update(doc(db, `stores/${CODE}/questions/${qid}`), {
    reportCount: increment(1),
    ...(hide ? { hidden: true, hiddenBy: 'report' } : {}),
  });
  return b.commit();
}

async function seed(fn: (db: Firestore) => Promise<void>) {
  await env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-qplace',
    firestore: {
      rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, `stores/${CODE}`), storeData(OWNER));
    await setDoc(doc(db, `users/${OWNER}`), { storeCode: CODE, uiLang: 'ko', agreed: {}, createdAt: Timestamp.now() });
  });
});

describe('가입', () => {
  const signup = (db: Firestore, uid: string, code: string) => {
    const b = writeBatch(db);
    b.set(doc(db, `stores/${code}`), { ...storeData(uid, 'pending'), createdAt: serverTimestamp() });
    b.set(doc(db, `users/${uid}`), {
      storeCode: code, uiLang: 'ko',
      agreed: { terms: '2026-11-19', privacy: '2026-11-19', age14: true },
      createdAt: serverTimestamp(),
    });
    return b.commit();
  };
  const newUser = (uid: string) => env.authenticatedContext(uid, unverifiedToken).firestore();

  it('새 계정은 가게 + users를 한 배치로 만들 수 있다', async () => {
    await assertSucceeds(signup(newUser('new1'), 'new1', 'zzzz2345'));
  });
  it('이미 있는 코드는 못 쓴다', async () => {
    await assertFails(signup(newUser('new1'), 'new1', CODE));
  });
  it('계정 하나로 가게 두 개는 못 만든다', async () => {
    await assertFails(signup(owner(), OWNER, 'zzzz2345'));
  });
  it('형식에 안 맞는 코드는 거부', async () => {
    await assertFails(signup(newUser('new1'), 'new1', 'ABCD0000'));
  });
  it('익명 계정은 가게를 못 만든다', async () => {
    await assertFails(signup(anon(), 'anon1', 'zzzz2345'));
  });
  it('14세 동의 없으면 거부', async () => {
    const db = newUser('new1');
    const b = writeBatch(db);
    b.set(doc(db, 'stores/zzzz2345'), { ...storeData('new1', 'pending'), createdAt: serverTimestamp() });
    b.set(doc(db, 'users/new1'), {
      storeCode: 'zzzz2345', uiLang: 'ko', agreed: { terms: 'v', privacy: 'v', age14: false }, createdAt: serverTimestamp(),
    });
    await assertFails(b.commit());
  });
});

describe('가게 설정', () => {
  it('인증 안 된 주인은 pending → active 못 바꾼다', async () => {
    await seed(async (db) => setDoc(doc(db, 'stores/pend2345'), storeData('u2', 'pending')));
    const db = env.authenticatedContext('u2', unverifiedToken).firestore();
    await assertFails(updateDoc(doc(db, 'stores/pend2345'), { status: 'active' }));
  });
  it('인증된 주인은 pending → active 가능', async () => {
    await seed(async (db) => setDoc(doc(db, 'stores/pend2345'), storeData(OWNER, 'pending')));
    await assertSucceeds(updateDoc(doc(owner(), 'stores/pend2345'), { status: 'active' }));
  });
  it('상호명 21자 · 소개 31자는 거부', async () => {
    await assertFails(updateDoc(doc(owner(), `stores/${CODE}`), { storeName: '가'.repeat(21) }));
    await assertFails(updateDoc(doc(owner(), `stores/${CODE}`), { intro: '가'.repeat(31) }));
  });
  it('주인은 상호명 · 소개 변경 가능, 남은 불가', async () => {
    await assertSucceeds(updateDoc(doc(owner(), `stores/${CODE}`), { storeName: '새 이름', intro: '주말 10시 오픈' }));
    await assertFails(updateDoc(doc(anon(), `stores/${CODE}`), { storeName: '해킹' }));
  });
  it('업종 · 색은 정해진 값만', async () => {
    await assertSucceeds(updateDoc(doc(owner(), `stores/${CODE}`), { category: 'person', tone: '#ab12ef' }));
    await assertFails(updateDoc(doc(owner(), `stores/${CODE}`), { category: 'casino' }));
    await assertFails(updateDoc(doc(owner(), `stores/${CODE}`), { tone: 'mint' }));
  });
  it('주인이 ownerUid는 못 바꾼다', async () => {
    await assertFails(updateDoc(doc(owner(), `stores/${CODE}`), { ownerUid: 'other' }));
  });
  it('이용 제한 중이면 설정 변경 불가, 운영자는 제한 · 해제 가능', async () => {
    await assertSucceeds(updateDoc(doc(admin(), `stores/${CODE}`), { status: 'suspended' }));
    await assertFails(updateDoc(doc(owner(), `stores/${CODE}`), { storeName: '바꿈' }));
    await assertSucceeds(updateDoc(doc(admin(), `stores/${CODE}`), { status: 'active' }));
  });
  it('가게 문서는 아무도 삭제 못 한다', async () => {
    await assertFails(deleteDoc(doc(owner(), `stores/${CODE}`)));
  });
});

describe('손님 질문', () => {
  it('질문 + 작성자 기록 + 쓰기 간격 배치는 성공', async () => {
    await assertSucceeds(postQuestion(anon(), 'anon1', 'q1'));
  });
  it('작성자 기록 없이 질문만 쓰면 거부', async () => {
    await assertFails(postQuestion(anon(), 'anon1', 'q1', { author: false }));
  });
  it('쓰기 간격 기록 없이 쓰면 거부', async () => {
    await assertFails(postQuestion(anon(), 'anon1', 'q1', { throttle: false }));
  });
  it('30초 안에 두 번 쓰면 거부', async () => {
    await assertSucceeds(postQuestion(anon(), 'anon1', 'q1'));
    await assertFails(postQuestion(anon(), 'anon1', 'q2'));
  });
  it('30초가 지났으면 다시 쓸 수 있다', async () => {
    await seed(async (db) => setDoc(doc(db, 'throttle/anon1'), { lastPostAt: Timestamp.fromMillis(Date.now() - 60_000) }));
    await assertSucceeds(postQuestion(anon(), 'anon1', 'q2'));
  });
  it('차단된 기기는 거부', async () => {
    await seed(async (db) => setDoc(doc(db, `stores/${CODE}/blocked/anon1`), { at: Timestamp.now(), snippet: '' }));
    await assertFails(postQuestion(anon(), 'anon1', 'q1'));
  });
  it('질문 받기 중지 · 준비 중 · 이용 제한 가게는 거부', async () => {
    for (const patch of [{ acceptingQuestions: false }, { status: 'pending' }, { status: 'suspended' }]) {
      await seed(async (db) => setDoc(doc(db, `stores/${CODE}`), { ...storeData(OWNER), ...patch }));
      await assertFails(postQuestion(anon(), 'anon1', `q-${Object.values(patch)[0]}`));
    }
  });
  it('답변 · 가림 상태를 미리 넣어 쓰면 거부', async () => {
    const db = anon();
    const b = writeBatch(db);
    b.set(doc(db, `stores/${CODE}/questions/q1`), { ...questionData({ hidden: true }), createdAt: serverTimestamp() });
    b.set(doc(db, `stores/${CODE}/authors/q1`), { uid: 'anon1' });
    b.set(doc(db, 'throttle/anon1'), { lastPostAt: serverTimestamp() });
    await assertFails(b.commit());
  });
  it('1자 질문은 거부', async () => {
    const db = anon();
    const b = writeBatch(db);
    b.set(doc(db, `stores/${CODE}/questions/q1`), { ...questionData({ body: '아' }), createdAt: serverTimestamp() });
    b.set(doc(db, `stores/${CODE}/authors/q1`), { uid: 'anon1' });
    b.set(doc(db, 'throttle/anon1'), { lastPostAt: serverTimestamp() });
    await assertFails(b.commit());
  });
});

describe('읽기', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `stores/${CODE}/questions/open1`), questionData());
      await setDoc(doc(db, `stores/${CODE}/questions/hid1`), questionData({ hidden: true, hiddenBy: 'owner' }));
      await setDoc(doc(db, `stores/${CODE}/authors/open1`), { uid: 'anon1' });
    });
  });
  it('손님은 hidden == false 쿼리로 목록을 읽는다', async () => {
    await assertSucceeds(getDocs(query(collection(guest(), `stores/${CODE}/questions`), where('hidden', '==', false))));
  });
  it('필터 없는 손님 목록 쿼리는 거부', async () => {
    await assertFails(getDocs(collection(guest(), `stores/${CODE}/questions`)));
  });
  it('가려진 질문은 링크로 직접 읽어도 거부, 주인 · 운영자는 가능', async () => {
    await assertFails(getDoc(doc(guest(), `stores/${CODE}/questions/hid1`)));
    await assertSucceeds(getDoc(doc(owner(), `stores/${CODE}/questions/hid1`)));
    await assertSucceeds(getDoc(doc(admin(), `stores/${CODE}/questions/hid1`)));
  });
  it('작성자 기록은 주인과 작성자 본인만', async () => {
    await assertSucceeds(getDoc(doc(owner(), `stores/${CODE}/authors/open1`)));
    await assertSucceeds(getDoc(doc(anon('anon1'), `stores/${CODE}/authors/open1`)));
    await assertFails(getDoc(doc(anon('anon2'), `stores/${CODE}/authors/open1`)));
  });
  it('users 문서는 본인만', async () => {
    await assertSucceeds(getDoc(doc(owner(), `users/${OWNER}`)));
    await assertFails(getDoc(doc(anon(), `users/${OWNER}`)));
  });
});

describe('사장님 관리', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `stores/${CODE}/questions/q1`), questionData());
      await setDoc(doc(db, `stores/${CODE}/authors/q1`), { uid: 'anon1' });
    });
  });
  const q1 = (db: Firestore) => doc(db, `stores/${CODE}/questions/q1`);

  it('답변 달기 · 지우기', async () => {
    await assertSucceeds(updateDoc(q1(owner()), { answer: { body: '네 팝니다', at: serverTimestamp(), editedAt: null }, status: 'answered' }));
    await assertSucceeds(updateDoc(q1(owner()), { answer: null, status: 'open' }));
  });
  it('답변 있는데 status open이면 거부', async () => {
    await assertFails(updateDoc(q1(owner()), { answer: { body: '네', at: serverTimestamp(), editedAt: null }, status: 'open' }));
  });
  it('질문 본문은 주인도 못 고친다', async () => {
    await assertFails(updateDoc(q1(owner()), { body: '조작' }));
  });
  it('인증 안 된 계정 · 남은 답변 못 단다', async () => {
    const unverified = env.authenticatedContext(OWNER, unverifiedToken).firestore();
    await assertFails(updateDoc(q1(unverified), { answer: { body: '네', at: serverTimestamp(), editedAt: null }, status: 'answered' }));
    await assertFails(updateDoc(q1(anon('anon2')), { answer: { body: '네', at: serverTimestamp(), editedAt: null }, status: 'answered' }));
  });
  it('숨기기 · 다시 공개 · 고정', async () => {
    await assertSucceeds(updateDoc(q1(owner()), { hidden: true, hiddenBy: 'owner' }));
    await assertSucceeds(updateDoc(q1(owner()), { hidden: false, hiddenBy: null, pinned: true }));
  });
  it('주인이 hiddenBy를 admin으로 쓰면 거부', async () => {
    await assertFails(updateDoc(q1(owner()), { hidden: true, hiddenBy: 'admin' }));
  });
  it('운영자가 가린 질문은 주인이 못 푼다', async () => {
    await seed(async (db) => updateDoc(doc(db, `stores/${CODE}/questions/q1`), { hidden: true, hiddenBy: 'admin' }));
    await assertFails(updateDoc(q1(owner()), { hidden: false, hiddenBy: null }));
  });
  it('삭제: 주인 · 작성자 본인 가능, 남은 불가', async () => {
    await assertFails(deleteDoc(q1(anon('anon2'))));
    await assertSucceeds(deleteDoc(q1(anon('anon1'))));
  });
  it('주인 삭제', async () => {
    await assertSucceeds(deleteDoc(q1(owner())));
  });
  it('차단 목록은 주인만', async () => {
    await assertSucceeds(setDoc(doc(owner(), `stores/${CODE}/blocked/anon1`), { at: serverTimestamp(), snippet: '디카페인' }));
    await assertFails(setDoc(doc(anon('anon1'), `stores/${CODE}/blocked/anon1`), { at: serverTimestamp(), snippet: '' }));
  });
});

describe('신고', () => {
  beforeEach(async () => {
    await seed(async (db) => setDoc(doc(db, `stores/${CODE}/questions/q1`), questionData()));
  });

  it('신고 1건은 숫자만 +1', async () => {
    await assertSucceeds(report(anon('r1'), 'r1', 'q1', 1));
  });
  it('같은 사람이 두 번 신고하면 거부', async () => {
    await assertSucceeds(report(anon('r1'), 'r1', 'q1', 1));
    await assertFails(report(anon('r1'), 'r1', 'q1', 2));
  });
  it('신고 문서 없이 숫자만 올리면 거부', async () => {
    await assertFails(report(anon('r1'), 'r1', 'q1', 1, { withDoc: false }));
  });
  it('3번째 신고는 반드시 가려야 한다', async () => {
    await assertSucceeds(report(anon('r1'), 'r1', 'q1', 1));
    await assertSucceeds(report(anon('r2'), 'r2', 'q1', 2));
    await assertFails(report(anon('r3'), 'r3', 'q1', 3, { hide: false }));
    await assertSucceeds(report(anon('r3'), 'r3', 'q1', 3));
  });
  it('3건 전에 가리면 거부', async () => {
    await assertFails(report(anon('r1'), 'r1', 'q1', 1, { hide: true }));
  });
  it('숫자를 2 올리면 거부', async () => {
    const db = anon('r1');
    const b = writeBatch(db);
    b.set(doc(db, 'reports/q1_r1'), {
      targetType: 'question', storeCode: CODE, targetId: 'q1', reason: 'abuse', detail: '',
      reporterUid: 'r1', status: 'open', createdAt: serverTimestamp(),
    });
    b.update(doc(db, `stores/${CODE}/questions/q1`), { reportCount: increment(2) });
    await assertFails(b.commit());
  });
  it('가게 신고', async () => {
    await assertSucceeds(setDoc(doc(anon('r1'), `reports/${CODE}_r1`), {
      targetType: 'store', storeCode: CODE, targetId: CODE, reason: 'spam', detail: '광고만 올라와요',
      reporterUid: 'r1', status: 'open', createdAt: serverTimestamp(),
    }));
  });
  it('신고 목록은 운영자만 읽는다', async () => {
    await assertSucceeds(getDocs(collection(admin(), 'reports')));
    await assertFails(getDocs(collection(owner(), 'reports')));
  });
});
