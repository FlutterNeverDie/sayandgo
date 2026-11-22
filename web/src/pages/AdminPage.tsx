import { useQuery, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../app/auth';
import { TextField } from '../components/ui/Fields';
import { CopyIcon } from '../components/ui/Icons';
import { PublicTopbar } from '../components/ui/Layout';
import { useToast } from '../components/ui/Overlay';
import { ErrorBox, Loading } from '../components/ui/States';
import { PRESET_TONES, StoreIcon } from '../components/ui/StoreIcon';
import { CategoryPicker, TonePicker } from '../components/ui/StorePickers';
import {
  claimToken,
  claimUrl,
  feedbackCount,
  isAdminUser,
  listAdminStores,
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
import { Share } from './SharePage';

/* 운영자 전용: 매장에 직접 가서 세팅해 주는 화면. 내부 도구라 한국어만 쓴다. */

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!isAdminUser(user))
    return (
      <>
        <PublicTopbar back />
        <main className="page page--fill">
          <div className="center-state center-state--big">
            <h1>운영자만 볼 수 있어요</h1>
          </div>
        </main>
      </>
    );
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
  const [creating, setCreating] = useState(false);
  const list = useQuery({ queryKey: ['adminStores'], queryFn: listAdminStores, staleTime: 30_000 });
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
          <SetupForm onCancel={() => setCreating(false)} />
        ) : (
          <button type="button" className="btn btn--black btn--lg btn--block" onClick={() => setCreating(true)}>
            새 매장 세팅하기
          </button>
        )}

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

function SetupForm({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
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
  };
  const show = (k: keyof typeof errs) => (submitted ? errs[k] : null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);
    if (errs.storeName || errs.intro || errs.email) return;
    const input = { storeName, category: category ?? 'other', tone, intro };
    await run(async () => {
      try {
        if (mode === 'account') {
          const { code, password } = await setupWithAccount({ ...input, email });
          await qc.invalidateQueries({ queryKey: ['adminStores'] });
          navigate(`/admin/s/${code}`, { state: { password } });
        } else {
          const { code } = await setupWithClaim(input);
          await qc.invalidateQueries({ queryKey: ['adminStores'] });
          navigate(`/admin/s/${code}`);
        }
      } catch (err) {
        const c = (err as { code?: string }).code;
        setFormError(
          c === 'auth/email-already-in-use'
            ? '이미 가입된 이메일이에요. 연결 코드 방식으로 만들거나 다른 이메일을 써 주세요.'
            : c === 'auth/invalid-email'
              ? '이메일 형식을 확인해 주세요.'
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

      {mode === 'account' && (
        <TextField
          label="사장님 이메일"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
