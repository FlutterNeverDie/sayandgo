import { signInAnonymously, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getCountFromServer,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentSnapshot,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Question, QuestionKind, ReportReason, Visibility } from './types';

export const PAGE_SIZE = 10;

const qcol = (code: string) => collection(db, 'stores', code, 'questions');
const qdoc = (code: string, id: string) => doc(db, 'stores', code, 'questions', id);
const adoc = (code: string, id: string) => doc(db, 'stores', code, 'authors', id);

const toDate = (v: unknown): Date | null => (v instanceof Timestamp ? v.toDate() : null);

export function toQuestion(snap: DocumentSnapshot): Question {
  const d = snap.data({ serverTimestamps: 'estimate' })!;
  return {
    id: snap.id,
    body: d.body,
    lang: d.lang,
    kind: d.kind ?? 'question',
    visibility: d.visibility ?? 'public',
    status: d.status,
    answer: d.answer ? { body: d.answer.body, at: toDate(d.answer.at), editedAt: toDate(d.answer.editedAt) } : null,
    hidden: d.hidden,
    hiddenBy: d.hiddenBy ?? null,
    reportCount: d.reportCount ?? 0,
    pinned: d.pinned ?? false,
    createdAt: toDate(d.createdAt),
  };
}

export interface Page {
  items: Question[];
  cursor: QueryDocumentSnapshot | null; // 다음 페이지가 없으면 null
}

async function fetchPage(code: string, constraints: QueryConstraint[], cursor: QueryDocumentSnapshot | null): Promise<Page> {
  const parts = [...constraints, orderBy('createdAt', 'desc')];
  if (cursor) parts.push(startAfter(cursor));
  parts.push(limit(PAGE_SIZE));
  const snap = await getDocs(query(qcol(code), ...parts));
  return {
    items: snap.docs.map(toQuestion),
    cursor: snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null,
  };
}

// ---------- 손님 ----------

/** 손님에게 보이는 글 = 사장님이 답변한 공개 글 (보안 규칙과 같은 조건) */
const publicOnly = () => [where('hidden', '==', false), where('visibility', '==', 'public'), where('status', '==', 'answered')];

/** 손님 목록: 10개씩. 실시간 구독 안 함(읽기 절감). */
export function fetchPublicPage(code: string, cursor: QueryDocumentSnapshot | null) {
  return fetchPage(code, publicOnly(), cursor);
}

/** 가게 머리의 "답변 N". count()는 1,000건당 읽기 1회. */
export async function fetchAnsweredCount(code: string): Promise<number> {
  return (await getCountFromServer(query(qcol(code), ...publicOnly()))).data().count;
}

async function ensureSignedIn(): Promise<User> {
  await auth.authStateReady();
  return auth.currentUser ?? (await signInAnonymously(auth)).user;
}

const mineKey = (code: string) => `qplace:mine:${code}`;

export function myQuestionIds(code: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(mineKey(code)) ?? '[]'));
  } catch {
    return new Set();
  }
}

function rememberMine(code: string, id: string, add = true) {
  try {
    const ids = myQuestionIds(code);
    if (add) ids.add(id);
    else ids.delete(id);
    localStorage.setItem(mineKey(code), JSON.stringify([...ids].slice(-200)));
  } catch {
    /* 저장소를 못 쓰는 브라우저면 "내 질문" 표시만 빠진다 */
  }
}

/** 질문 + 작성자 기록 + 쓰기 간격을 한 배치로 (규칙이 셋 다 요구) */
export async function postQuestion(code: string, body: string, lang: string, kind: QuestionKind, visibility: Visibility): Promise<Question> {
  const user = await ensureSignedIn();
  const ref = doc(qcol(code));
  const b = writeBatch(db);
  b.set(ref, {
    body,
    lang,
    kind,
    visibility,
    status: 'open',
    answer: null,
    hidden: false,
    hiddenBy: null,
    reportCount: 0,
    pinned: false,
    createdAt: serverTimestamp(),
  });
  b.set(adoc(code, ref.id), { uid: user.uid });
  b.set(doc(db, 'throttle', user.uid), { lastPostAt: serverTimestamp() });
  await b.commit();
  rememberMine(code, ref.id);
  return { id: ref.id, body, lang, kind, visibility, status: 'open', answer: null, hidden: false, hiddenBy: null, reportCount: 0, pinned: false, createdAt: new Date() };
}

export async function deleteMyQuestion(code: string, id: string) {
  const b = writeBatch(db);
  b.delete(qdoc(code, id));
  b.delete(adoc(code, id));
  await b.commit();
  rememberMine(code, id, false);
}

const reportedKey = 'qplace:reported';

export function alreadyReported(targetId: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(reportedKey) ?? '[]') as string[]).includes(targetId);
  } catch {
    return false;
  }
}

function rememberReported(targetId: string) {
  try {
    const list = JSON.parse(localStorage.getItem(reportedKey) ?? '[]') as string[];
    localStorage.setItem(reportedKey, JSON.stringify([...list, targetId].slice(-500)));
  } catch {
    /* 무시: 규칙이 중복 신고를 막는다 */
  }
}

function reportDoc(user: User, code: string, targetType: 'question' | 'store', targetId: string, reason: ReportReason, detail: string) {
  return [
    doc(db, 'reports', `${targetId}_${user.uid}`),
    { targetType, storeCode: code, targetId, reason, detail, reporterUid: user.uid, status: 'open', createdAt: serverTimestamp() },
  ] as const;
}

/** 질문 신고: 신고 문서 + reportCount +1, 3건째면 같은 배치에서 가린다. */
export async function reportQuestion(code: string, q: Question, reason: ReportReason, detail: string) {
  const user = await ensureSignedIn();
  const attempt = async (currentCount: number) => {
    const b = writeBatch(db);
    const [ref, data] = reportDoc(user, code, 'question', q.id, reason, detail);
    b.set(ref, data);
    b.update(qdoc(code, q.id), {
      reportCount: increment(1),
      ...(currentCount + 1 >= 3 ? { hidden: true, hiddenBy: 'report' } : {}),
    });
    await b.commit();
  };
  try {
    await attempt(q.reportCount);
  } catch {
    // 그사이 다른 사람이 신고해 숫자가 바뀌었을 수 있다 → 최신 값으로 한 번 더
    const fresh = await getDocFromServer(qdoc(code, q.id));
    if (!fresh.exists()) throw new Error('gone');
    await attempt(fresh.data().reportCount ?? 0);
  }
  rememberReported(q.id);
}

export async function reportStore(code: string, reason: ReportReason, detail: string) {
  const user = await ensureSignedIn();
  const [ref, data] = reportDoc(user, code, 'store', code, reason, detail);
  await setDoc(ref, data);
  rememberReported(code);
}

// ---------- 사장님 ----------

export type InboxTab = 'open' | 'answered' | 'hidden';

function inboxConstraints(tab: InboxTab): QueryConstraint[] {
  if (tab === 'hidden') return [where('hidden', '==', true)];
  return [where('hidden', '==', false), where('status', '==', tab)];
}

/** 사장님 탭의 "답변 N · 질문 N · 숨김 N" (count() 3회) */
export async function fetchOwnerCounts(code: string): Promise<Record<InboxTab, number>> {
  const [open, answered, hidden] = await Promise.all(
    (['open', 'answered', 'hidden'] as InboxTab[]).map((tab) => getCountFromServer(query(qcol(code), ...inboxConstraints(tab)))),
  );
  return { open: open.data().count, answered: answered.data().count, hidden: hidden.data().count };
}

/** 첫 10개만 실시간 구독 (처음 이후엔 바뀐 문서만 과금) */
export function subscribeInbox(code: string, tab: InboxTab, onChange: (page: Page) => void, onError: (e: Error) => void) {
  const q = query(qcol(code), ...inboxConstraints(tab), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
  return onSnapshot(
    q,
    (snap) =>
      onChange({
        items: snap.docs.map(toQuestion),
        cursor: snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null,
      }),
    onError,
  );
}

export function fetchInboxPage(code: string, tab: InboxTab, cursor: QueryDocumentSnapshot) {
  return fetchPage(code, inboxConstraints(tab), cursor);
}

export async function saveAnswer(code: string, q: Question, body: string) {
  await updateDoc(qdoc(code, q.id), {
    answer: {
      body,
      at: q.answer?.at ? Timestamp.fromDate(q.answer.at) : serverTimestamp(),
      editedAt: q.answer ? serverTimestamp() : null,
    },
    status: 'answered',
  });
}

export async function removeAnswer(code: string, id: string) {
  await updateDoc(qdoc(code, id), { answer: null, status: 'open' });
}

export async function setHidden(code: string, ids: string[], hidden: boolean) {
  const b = writeBatch(db);
  for (const id of ids) b.update(qdoc(code, id), { hidden, hiddenBy: hidden ? 'owner' : null });
  await b.commit();
}

export async function setPinned(code: string, id: string, pinned: boolean) {
  await updateDoc(qdoc(code, id), { pinned });
}

export async function deleteQuestions(code: string, ids: string[]) {
  const b = writeBatch(db);
  for (const id of ids) {
    b.delete(qdoc(code, id));
    b.delete(adoc(code, id));
  }
  await b.commit();
}

export async function blockAuthor(code: string, q: Question) {
  const author = await getDoc(adoc(code, q.id));
  if (!author.exists()) throw new Error('no-author');
  await setDoc(doc(db, 'stores', code, 'blocked', author.data().uid), {
    at: serverTimestamp(),
    snippet: q.body.slice(0, 20),
  });
}

export interface BlockedEntry {
  uid: string;
  at: Date | null;
  snippet: string;
}

export async function listBlocked(code: string): Promise<BlockedEntry[]> {
  const snap = await getDocs(query(collection(db, 'stores', code, 'blocked'), orderBy('at', 'desc'), limit(100)));
  return snap.docs.map((d) => ({ uid: d.id, at: toDate(d.data().at), snippet: d.data().snippet ?? '' }));
}

export async function unblock(code: string, uid: string) {
  await deleteDoc(doc(db, 'stores', code, 'blocked', uid));
}
