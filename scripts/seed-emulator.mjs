// 로컬 에뮬레이터에 샘플 데이터를 넣는다. 실제 프로젝트에는 쓰지 않는다.
// 사용: npm run emulators (다른 창) → node scripts/seed-emulator.mjs
const PROJECT = 'demo-qplace';
const AUTH = 'http://127.0.0.1:9099';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const ADMIN = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }; // 에뮬레이터 전용: 규칙 우회

const EMAIL = 'demo@qplace.test';
const PASSWORD = 'coffee2024';
const CODE = 'k7m2xp9a';

async function call(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${url}\n${await res.text()}`);
  return res.json();
}

function toFields(obj) {
  const v = (x) => {
    if (x === null) return { nullValue: null };
    if (x instanceof Date) return { timestampValue: x.toISOString() };
    if (typeof x === 'boolean') return { booleanValue: x };
    if (typeof x === 'number') return { integerValue: String(x) };
    if (typeof x === 'string') return { stringValue: x };
    if (Array.isArray(x)) return { arrayValue: { values: x.map(v) } };
    return { mapValue: { fields: toFields(x) } };
  };
  return Object.fromEntries(Object.entries(obj).map(([k, x]) => [k, v(x)]));
}

const put = (path, data) => call(`${FS}/${path}`, { method: 'PATCH', headers: ADMIN, body: JSON.stringify({ fields: toFields(data) }) });
const ago = (min) => new Date(Date.now() - min * 60_000);

// 초기화
await fetch(`${FS}`, { method: 'DELETE', headers: ADMIN });
await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE', headers: ADMIN });

const { localId: uid } = await call(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
});
await call(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, {
  method: 'POST',
  headers: ADMIN,
  body: JSON.stringify({ localId: uid, emailVerified: true }),
});

await put(`stores/${CODE}`, {
  storeName: '연남동 로스터리',
  intro: '평일 8시, 주말 10시에 열어요',
  ownerUid: uid,
  lang: 'ko',
  status: 'active',
  acceptingQuestions: true,
  showUnanswered: true,
  blockedWords: ['옆집카페'],
  createdAt: ago(60 * 24 * 10),
});
await put(`users/${uid}`, {
  storeCode: CODE,
  uiLang: 'ko',
  agreed: { terms: '2026-11-19', privacy: '2026-11-19', age14: true },
  createdAt: ago(60 * 24 * 10),
});

const questions = [
  ['와이파이 비밀번호가 뭐예요?', '영수증 하단에 적혀 있어요. 카운터에 물어보셔도 돼요!', 3],
  ['콘센트 있는 자리가 어디인가요? 노트북 하려고요', null, 12],
  ['디카페인 원두도 따로 파시나요?', '네, 200g 단위로 팔아요. 원두 선반 맨 아래 칸에 있어요.', 45],
  ['주차는 어디에 하면 되나요?', '건물 뒤 공영주차장을 이용해 주세요. 1시간 주차권 드려요.', 90],
  ['오늘 라떼가 평소보다 좀 연한 것 같아요', null, 130],
  ['반려견 동반 가능한가요? 작은 강아지예요', '테라스 자리는 가능해요. 실내는 어려워요.', 300],
  ['드립 커피 원두 산지가 궁금해요', null, 420],
  ['단체 예약 되나요? 8명 정도요', '평일 오후 2~5시는 가능해요. 하루 전에 전화 주세요.', 700],
  ['화장실 비밀번호 알려 주세요', '1234* 입니다.', 900],
  ['케이크는 매일 직접 굽나요?', null, 1400],
  ['노키즈존인가요?', '아니에요, 아이와 함께 오셔도 돼요.', 2000],
  ['음악 소리가 조금 커요', null, 2600],
  ['직원분 너무 친절해요 감사합니다', '감사합니다! 전달할게요 :)', 4000],
];

let i = 0;
for (const [body, answer, min] of questions) {
  const id = `q${String(++i).padStart(2, '0')}`;
  await put(`stores/${CODE}/questions/${id}`, {
    body,
    lang: 'ko',
    status: answer ? 'answered' : 'open',
    answer: answer ? { body: answer, at: ago(min - 2), editedAt: null } : null,
    hidden: false,
    hiddenBy: null,
    reportCount: 0,
    pinned: false,
    createdAt: ago(min),
  });
  await put(`stores/${CODE}/authors/${id}`, { uid: `anon-${i}` });
}

// 숨긴 질문 · 신고로 가려진 질문
await put(`stores/${CODE}/questions/qh1`, {
  body: '여기 사장님 연락처 좀 알려 주세요', lang: 'ko', status: 'open', answer: null,
  hidden: true, hiddenBy: 'owner', reportCount: 0, pinned: false, createdAt: ago(200),
});
await put(`stores/${CODE}/questions/qh2`, {
  body: '알바생 OOO 진짜 불친절하네요', lang: 'ko', status: 'open', answer: null,
  hidden: true, hiddenBy: 'report', reportCount: 3, pinned: false, createdAt: ago(500),
});

console.log(`완료\n  사장님 로그인: ${EMAIL} / ${PASSWORD}\n  손님 화면: http://127.0.0.1:5173/q/${CODE}`);
