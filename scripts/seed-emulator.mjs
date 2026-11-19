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
  category: 'cafe',
  tone: '#3ccfae',
  ownerUid: uid,
  lang: 'ko',
  status: 'active',
  acceptingQuestions: true,
  blockedWords: ['옆집카페'],
  createdAt: ago(60 * 24 * 10),
});
await put(`users/${uid}`, {
  storeCode: CODE,
  uiLang: 'ko',
  agreed: { terms: '2026-11-19', privacy: '2026-11-19', age14: true },
  createdAt: ago(60 * 24 * 10),
});

// [질문, 답변(null이면 답변 전), 몇 분 전, 종류, 공개 범위]
const questions = [
  ['와이파이 비밀번호가 뭐예요?', '영수증 하단에 적혀 있어요. 카운터에 물어보셔도 돼요!', 3, 'question'],
  ['테라스에 담요가 있으면 좋겠어요', '좋은 생각이에요. 다음 주부터 테라스 의자마다 놓아 둘게요.', 25, 'suggestion'],
  ['음악 소리가 조금 커요. 대화하기가 힘들었어요', '말씀 감사해요. 오후엔 볼륨을 한 단계 줄였어요.', 50, 'complaint'],
  ['직원분이 원두 설명을 정말 친절하게 해 주셨어요', '감사합니다! 꼭 전해 드릴게요 :)', 80, 'praise'],
  ['디카페인 원두도 따로 파시나요?', '네, 200g 단위로 팔아요. 원두 선반 맨 아래 칸에 있어요.', 120, 'question'],
  ['오트밀크 옵션이 있으면 좋겠어요', '다음 달부터 오트밀크로 바꿀 수 있게 준비하고 있어요.', 200, 'suggestion'],
  ['주말엔 자리가 너무 없어요', '불편하셨죠. 주말 오전엔 테이블을 두 개 더 놓을게요.', 320, 'complaint'],
  ['라떼아트가 매번 예뻐서 기분 좋아요', '고마워요! 바리스타들이 엄청 좋아할 거예요.', 460, 'praise'],
  ['주차는 어디에 하면 되나요?', '건물 뒤 공영주차장을 이용해 주세요. 1시간 주차권 드려요.', 700, 'question'],
  ['원두 정기배송도 하시나요?', '아직은 아니지만 문의가 많아서 준비해 볼게요.', 900, 'suggestion'],
  ['화장실이 조금 지저분했어요', '죄송해요. 점검 주기를 2시간에서 1시간으로 바꿨어요.', 1300, 'complaint'],
  ['케이크가 너무 맛있어요. 특히 바스크 치즈케이크!', '매일 아침 직접 구워요. 감사합니다!', 1800, 'praise'],
  ['반려견 동반 가능한가요? 작은 강아지예요', '테라스 자리는 가능해요. 실내는 어려워요.', 2400, 'question'],
  ['노트북 쓸 수 있는 콘센트 자리가 더 있으면 좋겠어요', '창가 쪽에 멀티탭을 추가했어요.', 3200, 'suggestion'],
  ['아메리카노가 조금 썼어요', '로스팅을 살짝 낮춘 블렌드로 바꿔 봤어요. 다시 드셔 보세요.', 4100, 'complaint'],
  ['사장님 늘 웃으면서 맞아 주셔서 좋아요', '오실 때마다 반가워요!', 5000, 'praise'],
  // 답변 전 · 사장님만 보기 (손님 화면엔 안 보임)
  ['콘센트 있는 자리가 어디인가요? 노트북 하려고요', null, 12, 'question'],
  ['오늘 라떼가 평소보다 좀 연한 것 같아요', null, 130, 'complaint', 'owner'],
  ['케이크는 매일 직접 굽나요?', null, 1400, 'question'],
  ['포인트 적립 카드가 있으면 좋겠어요', null, 2600, 'suggestion'],
];

let i = 0;
for (const [body, answer, min, kind = 'question', visibility = 'public'] of questions) {
  const id = `q${String(++i).padStart(2, '0')}`;
  await put(`stores/${CODE}/questions/${id}`, {
    body,
    lang: 'ko',
    kind,
    visibility,
    status: answer ? 'answered' : 'open',
    answer: answer ? { body: answer, at: ago(min - 2), editedAt: null } : null,
    hidden: false,
    hiddenBy: null,
    reportCount: 0,
    helpful: answer ? (i * 7) % 13 : 0,
    pinned: false,
    createdAt: ago(min),
  });
  await put(`stores/${CODE}/authors/${id}`, { uid: `anon-${i}` });
}

// 숨긴 질문 · 신고로 가려진 질문
await put(`stores/${CODE}/questions/qh1`, {
  body: '여기 사장님 연락처 좀 알려 주세요', lang: 'ko', kind: 'question', visibility: 'public', status: 'open', answer: null,
  hidden: true, hiddenBy: 'owner', reportCount: 0, helpful: 0, pinned: false, createdAt: ago(200),
});
await put(`stores/${CODE}/questions/qh2`, {
  body: '알바생 OOO 진짜 불친절하네요', lang: 'ko', kind: 'complaint', visibility: 'public', status: 'open', answer: null,
  hidden: true, hiddenBy: 'report', reportCount: 3, helpful: 0, pinned: false, createdAt: ago(500),
});

console.log(`완료\n  사장님 로그인: ${EMAIL} / ${PASSWORD}\n  손님 화면: http://127.0.0.1:5173/q/${CODE}`);
