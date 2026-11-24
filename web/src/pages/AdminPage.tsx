import { useQuery, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../app/auth';
import { AppMark } from '../components/ui/AppMark';
import { EmailField, TextField } from '../components/ui/Fields';
import { CopyIcon } from '../components/ui/Icons';
import { PublicTopbar } from '../components/ui/Layout';
import { useToast } from '../components/ui/Overlay';
import { ErrorBox, Loading } from '../components/ui/States';
import { PRESET_TONES, StoreIcon } from '../components/ui/StoreIcon';
import { CategoryPicker, TonePicker } from '../components/ui/StorePickers';
import {
  cardLabel,
  claimToken,
  claimUrl,
  createCards,
  feedbackCount,
  isAdminUser,
  listAdminStores,
  listBlankCards,
  parseCard,
  setupWithAccount,
  setupWithClaim,
  type AdminStore,
} from '../lib/admin';
import { db } from '../lib/firebase';
import { getStore } from '../lib/stores';
import { storeUrl } from '../lib/storeCode';
import type { StoreCategory } from '../lib/types';
import { useLock } from '../lib/useLock';
import { checkEmail, checkIntro, checkStoreName, LIMITS } from '../lib/validation';
import { NotFoundPage } from './MiscPages';
import { Share } from './SharePage';

/* 운영자 전용: 매장에 직접 가서 세팅해 주는 화면. 내부 도구라 한국어만 쓴다. */

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  // 로그인 전이거나 운영자가 아니면 이 화면이 있다는 것도 드러내지 않는다 (운영자는 로그인 후 설정에서 들어온다)
  if (!isAdminUser(user)) return <NotFoundPage />;
  return <>{children}</>;
}

function copyText(text: string, toast: (m: string) => void) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast('복사했어요'))
    .catch(() => toast('복사하지 못했어요'));
}

/** /admin: 새 매장 세팅 + 내가 세팅한 매장 목록 */
export function AdminPage() {
  return (
    <RequireAdmin>
      <AdminHome />
    </RequireAdmin>
  );
}

function AdminHome() {
  // 카드를 폰으로 찍고 "이 카드를 매장에 연결하기"로 들어오면 ?card=코드
  const [params] = useSearchParams();
  const cardParam = parseCard(params.get('card') ?? '');
  const [creating, setCreating] = useState(!!cardParam);
  const list = useQuery({ queryKey: ['adminStores'], queryFn: listAdminStores, staleTime: 30_000 });
  const cards = useQuery({ queryKey: ['blankCards'], queryFn: listBlankCards, staleTime: 30_000 });
  return (
    <>
      <PublicTopbar back />
      <main className="page">
        <div className="title-row" style={{ display: 'block' }}>
          <h1 className="title">현장 세팅</h1>
          <p className="subtitle" style={{ marginTop: 4 }}>
            매장에 가서 사장님 대신 가게를 만들고 QR을 바로 드려요.
          </p>
        </div>

        {creating ? (
          <SetupForm initialCard={cardParam} onCancel={() => setCreating(false)} />
        ) : (
          <button type="button" className="btn btn--black btn--lg btn--block" onClick={() => setCreating(true)}>
            새 매장 세팅하기
          </button>
        )}

        <Link to="/admin/cards" className="admin-cards-link">
          <span>
            <b>빈 QR 카드</b>
            <span className="field__hint" style={{ marginTop: 0 }}>
              집에서 미리 뽑아 두고, 매장에서 상호만 연결해요
            </span>
          </span>
          <span className="menu-row__value">{cards.data ? `남은 카드 ${cards.data.length}장` : ''} ›</span>
        </Link>

        <section className="section" style={{ marginTop: 32 }}>
          <h2 className="section__title">세팅한 매장 {list.data ? list.data.length : ''}</h2>
          {list.isError && <ErrorBox onRetry={() => list.refetch()} />}
          {list.isLoading && <div className="skeleton" style={{ height: 72 }} />}
          {list.data?.length === 0 && <div className="empty">아직 세팅한 매장이 없어요.</div>}
          {!!list.data?.length && (
            <ul className="menu-group" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {list.data.map((s) => (
                <AdminRow key={s.code} s={s} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

function AdminRow({ s }: { s: AdminStore }) {
  const store = useQuery({ queryKey: ['store', s.code], queryFn: () => getStore(s.code), staleTime: 60_000 });
  const count = useQuery({ queryKey: ['adminCount', s.code], queryFn: () => feedbackCount(s.code), staleTime: 60_000 });
  const linked = !!store.data?.ownerUid;
  const state = s.mode === 'account' ? '사장님 계정' : linked ? '연결됨' : '연결 대기';
  return (
    <li>
      <Link to={`/admin/s/${s.code}`} className="menu-row" style={{ minHeight: 68 }}>
        <StoreIcon category={s.category} tone={s.tone} size={40} />
        <span style={{ display: 'grid', minWidth: 0 }}>
          <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.storeName}</b>
          <span className="field__hint" style={{ marginTop: 0 }}>
            {state} · 피드백 {count.data ?? '-'}
          </span>
        </span>
        <span className="menu-row__value">{s.createdAt ? s.createdAt.toLocaleDateString('ko-KR') : ''}</span>
      </Link>
    </li>
  );
}

function SetupForm({ initialCard, onCancel }: { initialCard: string | null; onCancel: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [cardText, setCardText] = useState(initialCard ? cardLabel(initialCard) : '');
  const card = parseCard(cardText);
  const [mode, setMode] = useState<'account' | 'claim'>('account');
  const [storeName, setStoreName] = useState('');
  const [category, setCategory] = useState<StoreCategory | null>(null);
  const [tone, setTone] = useState(PRESET_TONES[0]);
  const [intro, setIntro] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { busy, run } = useLock();

  const errs = {
    storeName: checkStoreName(storeName),
    intro: checkIntro(intro),
    email: mode === 'account' ? checkEmail(email) : null,
    card: cardText.trim() && !card ? '카드 아래쪽의 8자리 번호를 확인해 주세요.' : null,
  };
  const show = (k: keyof typeof errs) => (submitted ? errs[k] : null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);
    if (errs.storeName || errs.intro || errs.email || errs.card) return;
    const input = { storeName, category: category ?? 'other', tone, intro, card };
    await run(async () => {
      try {
        if (mode === 'account') {
          const { code, password } = await setupWithAccount({ ...input, email });
          await qc.invalidateQueries({ queryKey: ['adminStores'] });
          await qc.invalidateQueries({ queryKey: ['blankCards'] });
          navigate(`/admin/s/${code}`, { state: { password } });
        } else {
          const { code } = await setupWithClaim(input);
          await qc.invalidateQueries({ queryKey: ['adminStores'] });
          await qc.invalidateQueries({ queryKey: ['blankCards'] });
          navigate(`/admin/s/${code}`);
        }
      } catch (err) {
        const c = (err as { code?: string }).code;
        setFormError(
          c === 'auth/email-already-in-use'
            ? '이미 가입된 이메일이에요. 연결 코드 방식으로 만들거나 다른 이메일을 써 주세요.'
            : c === 'auth/invalid-email'
              ? '이메일 형식을 확인해 주세요.'
              : c === 'card/unknown'
                ? '운영자 화면에서 만든 카드가 아니에요. 카드 번호를 확인해 주세요.'
                : c === 'card/used'
                  ? '이미 다른 매장에 연결한 카드예요. 남은 카드를 써 주세요.'
                  : '만들지 못했어요. 잠시 뒤 다시 시도해 주세요.',
        );
      }
    });
  }

  return (
    <form className="panel" style={{ padding: 20 }} onSubmit={onSubmit} noValidate>
      <p className="share-label" style={{ marginTop: 0 }}>
        사장님 계정
      </p>
      <div className="segmented" role="radiogroup" aria-label="사장님 계정" style={{ marginBottom: 8 }}>
        <button type="button" role="radio" aria-selected={mode === 'account'} onClick={() => setMode('account')}>
          이메일로 바로 만들기
        </button>
        <button type="button" role="radio" aria-selected={mode === 'claim'} onClick={() => setMode('claim')}>
          연결 코드로 나중에
        </button>
      </div>
      <p className="field__hint" style={{ marginBottom: 16 }}>
        {mode === 'account'
          ? '사장님 이메일로 계정을 만들고 임시 비밀번호를 드려요. 메일 인증만 하시면 돼요.'
          : '이메일 없이 가게만 먼저 열어요. 사장님이 나중에 연결 코드로 가입하면 가게가 넘어가요.'}
      </p>

      <TextField
        label="빈 QR 카드 번호 (선택)"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={cardText}
        placeholder="예) abcd efgh"
        onChange={(e) => setCardText(e.target.value)}
        error={show('card')}
        hint={card ? '이 카드의 QR이 바로 이 매장 QR이 돼요.' : '미리 뽑아 온 카드를 쓰면 번호를 넣어 주세요. 비워 두면 새 QR을 만들어요.'}
      />
      {mode === 'account' && (
        <EmailField
          label="사장님 이메일"
          autoComplete="off"
          value={email}
          onValue={setEmail}
          error={show('email')}
        />
      )}
      <TextField
        label="상호명"
        maxLength={LIMITS.storeName}
        value={storeName}
        onChange={(e) => setStoreName(e.target.value)}
        error={show('storeName')}
        hint={`${storeName.trim().length} / ${LIMITS.storeName}`}
      />
      <TextField
        label="소개 한 줄 (선택)"
        maxLength={LIMITS.intro}
        value={intro}
        placeholder="예) 평일 8시, 주말 10시에 열어요"
        onChange={(e) => setIntro(e.target.value)}
        error={show('intro')}
        hint={`${intro.trim().length} / ${LIMITS.intro}`}
      />
      <div className="field">
        <span className="field__label">업종</span>
        <CategoryPicker value={category} onChange={setCategory} label="업종" />
      </div>
      <div className="field">
        <span className="field__label">색</span>
        <TonePicker value={tone} onChange={setTone} label="색" />
      </div>

      {formError && (
        <p className="field__error" role="alert" style={{ marginBottom: 12 }}>
          {formError}
        </p>
      )}
      <div style={{ display: 'grid', gap: 8 }}>
        <button className="btn btn--black btn--lg btn--block" disabled={busy}>
          {busy ? '만드는 중' : '만들고 QR 받기'}
        </button>
        <button type="button" className="btn btn--text btn--block" onClick={onCancel} disabled={busy}>
          취소
        </button>
      </div>
    </form>
  );
}

/** /admin/s/:code: 사장님께 드릴 정보 + QR 포스터 */
export function AdminStorePage() {
  return (
    <RequireAdmin>
      <AdminStore />
    </RequireAdmin>
  );
}

function useQrSvg(url: string | null) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    if (!url) return;
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#15201d', light: '#ffffff' } })
      .then(setSvg)
      .catch(() => undefined);
  }, [url]);
  return svg;
}

function AdminStore() {
  const { code = '' } = useParams();
  const location = useLocation();
  const toast = useToast();
  const password = (location.state as { password?: string } | null)?.password ?? null;
  const store = useQuery({ queryKey: ['store', code], queryFn: () => getStore(code), staleTime: 30_000 });
  const meta = useQuery({
    queryKey: ['adminStore', code],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'adminStores', code));
      return snap.exists() ? (snap.data() as { mode: 'account' | 'claim'; ownerEmail: string | null; claimCode: string | null }) : null;
    },
    staleTime: 60_000,
  });
  const count = useQuery({ queryKey: ['adminCount', code], queryFn: () => feedbackCount(code), staleTime: 30_000 });
  const linked = !!store.data?.ownerUid;
  const claim = meta.data?.mode === 'claim' && meta.data.claimCode ? meta.data.claimCode : null;
  const claimLink = claim && !linked ? claimUrl(code, claim) : null;
  const claimQr = useQrSvg(claimLink);

  if (store.isLoading || meta.isLoading) return <Loading />;
  if (store.isError || !store.data) return <Loading error onRetry={() => store.refetch()} />;
  const s = store.data;
  const shopUrl = storeUrl(code);

  const message =
    meta.data?.mode === 'account'
      ? [
          `[Say&Go] ${s.storeName} 세팅이 끝났어요!`,
          '',
          `로그인: ${window.location.origin}/login`,
          `이메일: ${meta.data.ownerEmail ?? ''}`,
          password ? `임시 비밀번호: ${password}` : '임시 비밀번호: 현장에서 알려 드린 비밀번호',
          '',
          '1. 메일함에서 Say&Go 인증 메일의 링크를 한 번 눌러 주세요.',
          '2. 로그인하면 손님 피드백을 바로 볼 수 있어요.',
          '3. 비밀번호는 설정 → 계정에서 바꿀 수 있어요.',
          '',
          `손님용 매장 링크: ${shopUrl}`,
        ].join('\n')
      : [
          `[Say&Go] ${s.storeName} 세팅이 끝났어요!`,
          '',
          '아래 링크로 가입하면 매장이 사장님 계정으로 연결돼요.',
          claimLink ?? '',
          claim ? `(연결 코드: ${claimToken(code, claim)})` : '',
          '',
          '그동안 들어온 손님 피드백도 가입하면 그대로 볼 수 있어요.',
          `손님용 매장 링크: ${shopUrl}`,
        ].join('\n');

  const top = (
    <section className="admin-card" aria-label="사장님께 드릴 정보">
      <div className="admin-card__head">
        <StoreIcon category={s.category} tone={s.tone} size={44} />
        <div style={{ minWidth: 0 }}>
          <b>{s.storeName}</b>
          <p className="field__hint" style={{ marginTop: 0 }}>
            {meta.data?.mode === 'account' ? '사장님 계정' : linked ? '사장님 연결됨' : '연결 대기'} · 피드백 {count.data ?? '-'}
          </p>
        </div>
      </div>

      {meta.data?.mode === 'account' && (
        <dl className="admin-kv">
          <dt>이메일</dt>
          <dd>{meta.data.ownerEmail}</dd>
          <dt>임시 비밀번호</dt>
          <dd>{password ? <b className="admin-pw">{password}</b> : <span className="field__hint">만들 때만 보여요. 잊었으면 사장님이 '비밀번호 찾기'로 새로 만들면 돼요.</span>}</dd>
        </dl>
      )}

      {claimLink && (
        <div className="admin-claim">
          <p className="admin-claim__title">사장님 가입용 QR (손님용 아님)</p>
          <p className="field__hint" style={{ marginTop: 0 }}>
            사장님 폰으로 이 QR을 찍으면 가입 화면이 열리고, 가입하면 이 가게가 사장님 것이 돼요.
          </p>
          <span className="admin-claim__qr" dangerouslySetInnerHTML={{ __html: claimQr }} />
          <p className="admin-claim__code">{claimToken(code, claim!)}</p>
        </div>
      )}

      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        <button type="button" className="btn btn--line btn--block" onClick={() => copyText(message, toast)}>
          <CopyIcon />
          사장님께 보낼 안내 문구 복사
        </button>
      </div>
    </section>
  );

  return <Share store={s} back="/admin" top={top} />;
}

/** /admin/cards: 빈 QR 카드 만들기 · 인쇄 (A4 한 장에 10장, 명함 크기) */
export function AdminCardsPage() {
  return (
    <RequireAdmin>
      <AdminCards />
    </RequireAdmin>
  );
}

const CARDS_PER_SHEET = 10;

function AdminCards() {
  const qc = useQueryClient();
  const toast = useToast();
  const cards = useQuery({ queryKey: ['blankCards'], queryFn: listBlankCards, staleTime: 30_000 });
  const [sheets, setSheets] = useState(1);
  const [style, setStyle] = useState(readCardPref);
  const { busy, run } = useLock();
  const list = cards.data ?? [];
  const copy = CARD_COPIES.find((c) => c.id === style.copy) ?? CARD_COPIES[0];
  const changeStyle = (design: CardDesign, c: CardCopy['id']) => {
    setStyle({ design, copy: c });
    try {
      localStorage.setItem(CARD_PREF_KEY, JSON.stringify({ design, copy: c }));
    } catch {
      /* 저장 못 해도 이번 화면에서는 바뀐다 */
    }
  };

  const make = () =>
    run(async () => {
      try {
        await createCards(sheets * CARDS_PER_SHEET);
        await qc.invalidateQueries({ queryKey: ['blankCards'] });
        toast(`카드 ${sheets * CARDS_PER_SHEET}장을 만들었어요`);
      } catch {
        toast('만들지 못했어요. 잠시 뒤 다시 시도해 주세요.');
      }
    });

  // 10장씩 A4 한 장
  const pages: typeof list[] = [];
  for (let i = 0; i < list.length; i += CARDS_PER_SHEET) pages.push(list.slice(i, i + CARDS_PER_SHEET));

  return (
    <>
      <div className="no-print">
        <PublicTopbar back />
      </div>
      <main className="page cards-page">
        <div className="no-print">
          <div className="title-row" style={{ display: 'block' }}>
            <h1 className="title">빈 QR 카드</h1>
            <p className="subtitle" style={{ marginTop: 4 }}>
              상호가 없는 QR 카드를 미리 뽑아 두세요. 매장에서 카드 번호로 세팅하면 그 카드가 바로 그 매장 QR이 돼요.
            </p>
          </div>

          <ol className="cards-steps">
            <li>여기서 카드를 만들고 A4로 인쇄해요 (명함 크기 10장, 스티커 용지도 돼요)</li>
            <li>매장에서 카드 한 장을 폰 카메라로 찍고 <b>이 카드를 매장에 연결하기</b>를 눌러요</li>
            <li>상호 · 업종만 넣으면 끝. 카드는 카운터나 테이블에 붙여 드려요</li>
          </ol>

          <div className="panel cards-make">
            <span className="field__label">새로 만들기</span>
            <div className="segmented" role="radiogroup" aria-label="장수">
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" role="radio" aria-selected={sheets === n} onClick={() => setSheets(n)}>
                  {n * CARDS_PER_SHEET}장
                </button>
              ))}
            </div>
            <button type="button" className="btn btn--black btn--block" onClick={make} disabled={busy}>
              {busy ? '만드는 중' : `카드 ${sheets * CARDS_PER_SHEET}장 만들기`}
            </button>
          </div>

          <CardStylePicker design={style.design} copy={copy} sampleCode={list[0]?.code ?? 'sample00'} onChange={changeStyle} />

          <div className="cards-bar">
            <h2 className="section__title" style={{ margin: 0 }}>
              남은 빈 카드 {cards.data ? `${list.length}장` : ''}
            </h2>
            {!!list.length && (
              <button type="button" className="btn btn--line" onClick={() => window.print()}>
                인쇄 · PDF 저장
              </button>
            )}
          </div>
          {cards.isError && <ErrorBox onRetry={() => cards.refetch()} />}
          {cards.isLoading && <div className="skeleton" style={{ height: 120 }} />}
          {cards.data?.length === 0 && <div className="empty">남은 카드가 없어요. 위에서 새로 만들어 주세요.</div>}
        </div>

        {pages.map((page, i) => (
          <div key={i} className="card-sheet">
            {page.map((c) => (
              <BlankCardView key={c.code} code={c.code} design={style.design} copy={copy} />
            ))}
          </div>
        ))}
      </main>
    </>
  );
}

/* 카드 디자인 · 문구 (docs/card-copy-options.html에서 고른 것) */
type CardDesign = 'C' | 'B' | 'D' | 'A';
const CARD_DESIGNS: { id: CardDesign; label: string }[] = [
  { id: 'C', label: '다크' },
  { id: 'B', label: '민트 반쪽' },
  { id: 'D', label: '말풍선' },
  { id: 'A', label: '기본' },
];
const CARD_COPIES = [
  { id: 'voice', title: ['고객의', '소리함'], sub: ['불편했던 점, 바라는 점', '익명으로 남겨 주세요'] },
  { id: 'word', title: ['사장님께', '한마디'], sub: ['좋았던 점도, 아쉬운 점도', '익명으로 편하게'] },
  { id: 'today', title: ['오늘', '어떠셨어요?'], sub: ['좋았던 점, 아쉬운 점', '사장님께 바로 전해져요'] },
  // 익명 강조: 손님이 망설이는 이유 1순위 "누가 썼는지 알면 어떡하지"에 바로 답한다
  { id: 'anon', title: ['익명', '피드백'], sub: ['누가 썼는지', '사장님도 몰라요'] },
] as const;
type CardCopy = (typeof CARD_COPIES)[number];
const CARD_PREF_KEY = 'sayandgo:cardStyle';

function readCardPref(): { design: CardDesign; copy: CardCopy['id'] } {
  try {
    const v = JSON.parse(localStorage.getItem(CARD_PREF_KEY) ?? 'null');
    if (v && CARD_DESIGNS.some((d) => d.id === v.design) && CARD_COPIES.some((c) => c.id === v.copy)) return v;
  } catch {
    /* 저장소를 못 쓰면 기본값 */
  }
  return { design: 'C', copy: 'voice' };
}

function CardStylePicker({
  design,
  copy,
  sampleCode,
  onChange,
}: {
  design: CardDesign;
  copy: CardCopy;
  sampleCode: string;
  onChange: (d: CardDesign, c: CardCopy['id']) => void;
}) {
  return (
    <div className="panel cards-make">
      <span className="field__label">디자인 (눌러서 고르기)</span>
      {/* 4종을 한눈에: 지금 고른 제목으로 미리 보여 준다 */}
      <div className="card-designs" role="radiogroup" aria-label="디자인">
        {CARD_DESIGNS.map((d) => (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-selected={design === d.id}
            className="card-designs__item"
            onClick={() => onChange(d.id, copy.id)}
          >
            <BlankCardView code={sampleCode} design={d.id} copy={copy} />
            <span className="card-designs__label">{d.label}</span>
          </button>
        ))}
      </div>
      <span className="field__label" style={{ marginTop: 6 }}>
        제목
      </span>
      <div className="segmented segmented--stack" role="radiogroup" aria-label="제목">
        {CARD_COPIES.map((c) => (
          <button key={c.id} type="button" role="radio" aria-selected={copy.id === c.id} onClick={() => onChange(design, c.id)}>
            {c.title.join(' ')}
          </button>
        ))}
      </div>
    </div>
  );
}

function BlankCardView({ code, design, copy }: { code: string; design: CardDesign; copy: CardCopy }) {
  const qr = useQrSvg(storeUrl(code));
  const long = Math.max(...copy.title.map((x) => x.length)) >= 6;
  // QR 오른쪽 아래에 작은 로고 (QR 위에 겹치지 않게 바깥 여백에)
  const qrEl = (
    <span className="bc-qrbox">
      <span className={`bc-qr${design === 'C' || design === 'B' ? ' bc-tile' : ''}`}>
        <span className="bc-qr__svg" dangerouslySetInnerHTML={{ __html: qr }} />
        <span className="bc-mark">
          <AppMark size={12} />
          Say&amp;Go
        </span>
      </span>
    </span>
  );
  const sub = (
    <p className="bc-sub">
      {copy.sub[0]}
      <br />
      {copy.sub[1]}
    </p>
  );
  const title =
    design === 'D' ? (
      <div className="bc-bubble">
        {copy.title[0]}
        <br />
        {copy.title[1]}
      </div>
    ) : (
      <b className="bc-title">
        {copy.title[0]}
        <br />
        {design === 'C' ? <em>{copy.title[1]}</em> : copy.title[1]}
      </b>
    );
  const text = (
    <div className="bc-text">
      {title}
      {sub}
    </div>
  );
  return (
    <div className={`blank-card bc--${design}${long ? ' bc--long' : ''}`}>
      {design === 'B' ? (
        <>
          <div className="bc-side">{qrEl}</div>
          {text}
        </>
      ) : design === 'A' ? (
        <>
          {qrEl}
          {text}
        </>
      ) : (
        <>
          {text}
          {qrEl}
        </>
      )}
    </div>
  );
}
