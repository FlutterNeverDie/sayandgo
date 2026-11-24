import { applyActionCode, confirmPasswordReset, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, verifyPasswordResetCode } from 'firebase/auth';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../app/auth';
import { parseClaimToken } from '../lib/admin';
import { AppMark } from '../components/ui/AppMark';
import { EmailField, PasswordField, TextField } from '../components/ui/Fields';
import { CategoryPicker } from '../components/ui/StorePickers';
import type { StoreCategory } from '../lib/types';
import { PublicTopbar } from '../components/ui/Layout';
import { Loading } from '../components/ui/States';
import { currentLang } from '../i18n';
import { auth } from '../lib/firebase';
import { errorKey } from '../lib/format';
import { getStore, signUp, verifyActionSettings, withContinueFallback } from '../lib/stores';
import { checkEmail, checkPassword, checkStoreName, LIMITS } from '../lib/validation';
import { useLock } from '../lib/useLock';

function AuthFrame({ title, subtitle, below, children }: { title: string; subtitle?: string; below?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <PublicTopbar />
      <main className="page page--narrow">
        <div className="auth__brand">
          <AppMark />
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="panel auth__card">{children}</div>
        {below && <div className="auth__below">{below}</div>}
      </main>
    </>
  );
}

export function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [storeName, setStoreName] = useState('');
  const [category, setCategory] = useState<StoreCategory | null>(null);
  const [agree, setAgree] = useState({ age14: false, terms: false, privacy: false });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const { busy, run } = useLock();
  const [formError, setFormError] = useState<string | null>(null);
  // 운영자가 현장에서 만든 가게를 연결 코드로 넘겨받기 (/signup?claim=가게코드-연결코드)
  const initialClaim = new URLSearchParams(window.location.search).get('claim') ?? '';
  const [claimMode, setClaimMode] = useState(!!initialClaim);
  const [claimInput, setClaimInput] = useState(initialClaim);
  const parsedClaim = claimMode ? parseClaimToken(claimInput) : null;
  const claimTarget = useQuery({
    queryKey: ['store', parsedClaim?.code],
    queryFn: () => getStore(parsedClaim!.code),
    enabled: !!parsedClaim,
    staleTime: 30_000,
  });
  const claimStoreOk = !!parsedClaim && !!claimTarget.data && !claimTarget.data.ownerUid;
  const claimHint = !claimInput.trim()
    ? t('signup.claimHint')
    : !parsedClaim
      ? t('signup.claimFormat')
      : claimTarget.isLoading
        ? t('common.loading')
        : claimStoreOk
          ? t('signup.claimStore', { name: claimTarget.data!.storeName })
          : t('errors.claimInvalid');

  const errs = {
    email: checkEmail(email),
    password: checkPassword(password),
    storeName: claimMode ? null : checkStoreName(storeName),
  };
  const show = (k: keyof typeof errs) => (submitted || touched[k] ? errs[k] : null);
  const allAgreed = agree.age14 && agree.terms && agree.privacy;
  const blur = (k: string) => () => setTouched((s) => ({ ...s, [k]: true }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);
    if (errs.email || errs.password || errs.storeName) return;
    if (!allAgreed) return setFormError('errors.agreeRequired');
    if (claimMode && !claimStoreOk) return setFormError('errors.claimInvalid');
    await run(async () => {
      try {
        const target = claimMode ? claimTarget.data! : null;
        await signUp({
          email,
          password,
          storeName: target ? target.storeName : storeName,
          lang: currentLang(),
          category: target ? target.category : category ?? 'other',
          claim: claimMode && parsedClaim ? parsedClaim : undefined,
        });
        navigate('/verify', { replace: true });
      } catch (err) {
        const c = (err as { code?: string }).code;
        setFormError(claimMode && c === 'permission-denied' ? 'errors.claimInvalid' : errorKey(err));
      }
    });
  }

  return (
    <AuthFrame
      title={t('signup.title')}
      subtitle={t('signup.subtitle')}
      below={
        <p className="subtitle">
          {t('signup.haveAccount')} <Link to="/login">{t('login.title')}</Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <EmailField
          label={t('signup.email')}
          autoComplete="email"
          value={email}
          onValue={setEmail}
          onBlur={blur('email')}
          error={show('email')}
          hint={t('signup.emailHint')}
        />
        <PasswordField
          label={t('signup.password')}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={blur('password')}
          error={show('password')}
          hint={t('signup.passwordHint')}
          showStrength
        />
        {claimMode ? (
          <>
            <TextField
              label={t('signup.claimLabel')}
              autoComplete="off"
              autoCapitalize="none"
              value={claimInput}
              placeholder="kjb9f5ep-ab23cd45"
              onChange={(e) => setClaimInput(e.target.value)}
              hint={claimHint}
            />
            <button type="button" className="text-btn" style={{ marginBottom: 16 }} onClick={() => setClaimMode(false)}>
              {t('signup.claimCancel')}
            </button>
          </>
        ) : (
          <>
          <TextField
            label={t('signup.storeName')}
            autoComplete="organization"
            maxLength={LIMITS.storeName}
            placeholder={t('signup.storeNamePlaceholder')}
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            onBlur={blur('storeName')}
            error={show('storeName')}
            hint={t('signup.storeNameHint')}
          />

          <div className="field">
            <span className="field__label" id="cat-label">
              {t('signup.category')}
            </span>
            <CategoryPicker value={category} onChange={setCategory} label={t('signup.category')} />
            <p className="field__hint">{t('signup.categoryHint')}</p>
          </div>

            <button type="button" className="text-btn" style={{ marginBottom: 16 }} onClick={() => setClaimMode(true)}>
              {t('signup.claimToggle')}
            </button>
          </>
        )}

        <fieldset className="panel" style={{ margin: '4px 0 20px', display: 'grid', gap: 4 }}>
          <legend className="sr-only">{t('signup.agreeAll')}</legend>
          <label className="check" style={{ fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={allAgreed}
              onChange={(e) => setAgree({ age14: e.target.checked, terms: e.target.checked, privacy: e.target.checked })}
            />
            {t('signup.agreeAll')}
          </label>
          <label className="check">
            <input type="checkbox" checked={agree.age14} onChange={(e) => setAgree((a) => ({ ...a, age14: e.target.checked }))} />
            {t('signup.age14')}
          </label>
          <label className="check">
            <input type="checkbox" checked={agree.terms} onChange={(e) => setAgree((a) => ({ ...a, terms: e.target.checked }))} />
            {t('signup.terms')}
            <Link to="/terms" target="_blank">
              {t('common.show')}
            </Link>
          </label>
          <label className="check">
            <input type="checkbox" checked={agree.privacy} onChange={(e) => setAgree((a) => ({ ...a, privacy: e.target.checked }))} />
            {t('signup.privacy')}
            <Link to="/privacy" target="_blank">
              {t('common.show')}
            </Link>
          </label>
        </fieldset>

        {formError && (
          <p className="field__error" role="alert" style={{ marginBottom: 12 }}>
            {t(formError)}
          </p>
        )}
        <button className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? t('common.loading') : t('signup.submit')}
        </button>
      </form>
    </AuthFrame>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, ready } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, run } = useLock();
  const [formError, setFormError] = useState<string | null>(null);
  const from = (location.state as { from?: string } | null)?.from ?? '/inbox';

  if (ready && user) return <Navigate to={user.emailVerified ? from : '/verify'} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (checkEmail(email) || !password) return setFormError('errors.wrongLogin');
    await run(async () => {
      try {
        const { user: u } = await signInWithEmailAndPassword(auth, email.trim(), password);
        navigate(u.emailVerified ? from : '/verify', { replace: true });
      } catch (err) {
        setFormError(errorKey(err));
      }
    });
  }

  return (
    <AuthFrame
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      below={
        <>
          <p className="subtitle">{t('login.noAccount')}</p>
          <Link to="/signup" className="btn btn--block btn--lg auth__alt">
            {t('landing.start')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <EmailField label={t('signup.email')} autoComplete="email" value={email} onValue={setEmail} />
        <PasswordField label={t('signup.password')} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {formError && (
          <p className="field__error" role="alert" style={{ marginBottom: 12 }}>
            {t(formError)}
          </p>
        )}
        <button className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? t('common.loading') : t('login.submit')}
        </button>
        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 14 }}>
          <Link to="/reset" style={{ color: 'var(--muted)' }}>
            {t('login.forgot')}
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}

const RESEND_KEY = 'sayandgo:verifySentAt';

export function VerifyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState<string | null>(null);
  const { busy, run } = useLock();
  const sentAt = Number(sessionStorage.getItem(RESEND_KEY) ?? 0) || 0;
  const wait = Math.max(0, 60 - Math.floor((now - sentAt) / 1000));

  useEffect(() => {
    if (!sessionStorage.getItem(RESEND_KEY)) sessionStorage.setItem(RESEND_KEY, String(Date.now()));
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // 메일 링크를 누르고 돌아오면 바로 확인한다: 화면이 열릴 때 · 탭으로 돌아올 때 · 그 뒤 3초마다
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!user) return;
    let stopped = false;
    let inFlight = false;
    const check = async () => {
      if (document.hidden || stopped || inFlight) return;
      inFlight = true;
      try {
        await user.reload().catch(() => undefined);
        const u = auth.currentUser;
        if (u?.emailVerified && !stopped) {
          setConfirming(true);
          // 서버 규칙이 보는 토큰에도 '인증됨'이 들어가게 새로 받아 둔다 (안 그러면 가게 열기가 한 번 막힌다)
          await u.getIdToken(true).catch(() => undefined);
          if (!stopped) navigate('/inbox', { replace: true });
        }
      } finally {
        inFlight = false;
      }
    };
    check();
    const timer = setInterval(check, 3000);
    const onBack = () => check();
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
    };
  }, [user, navigate]);

  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.emailVerified) return <Navigate to="/inbox" replace />;
  if (confirming) return <Loading label={t('common.verifyDone')} />;

  const resend = () =>
    run(async () => {
      if (!user) return;
      try {
        auth.languageCode = currentLang();
        await withContinueFallback((withUrl) => sendEmailVerification(user, withUrl ? verifyActionSettings() : undefined));
        sessionStorage.setItem(RESEND_KEY, String(Date.now()));
        setNow(Date.now());
        setMessage(t('verify.resent'));
      } catch (err) {
        setMessage(t(errorKey(err)));
      }
    });

  const checkNow = () =>
    run(async () => {
      await user!.reload().catch(() => undefined);
      if (auth.currentUser?.emailVerified) {
        await auth.currentUser.getIdToken(true).catch(() => undefined);
        navigate('/inbox', { replace: true });
      } else setMessage(t('verify.notYet'));
    });

  return (
    <AuthFrame title={t('verify.title')} subtitle={t('verify.spam')}>
      <p style={{ marginBottom: 8 }}>{t('verify.desc', { email: user.email })}</p>
      <div style={{ display: 'grid', gap: 8 }}>
        <button className="btn btn--primary btn--block" onClick={checkNow} disabled={busy}>
          {t('verify.check')}
        </button>
        <button className="btn btn--block" onClick={resend} disabled={busy || wait > 0}>
          {wait > 0 ? t('verify.resendIn', { s: wait }) : t('verify.resend')}
        </button>
      </div>
      {message && (
        <p className="notice" role="status" style={{ marginTop: 16 }}>
          {message}
        </p>
      )}
      <button
        className="btn btn--text"
        style={{ marginTop: 24 }}
        onClick={async () => {
          await signOut(auth);
          navigate('/login');
        }}
      >
        {t('verify.other')}
      </button>
    </AuthFrame>
  );
}

export function ResetPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, run } = useLock();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const err = checkEmail(email);
    if (err) return setError(err);
    await run(async () => {
      try {
        auth.languageCode = currentLang();
        await withContinueFallback((withUrl) =>
          sendPasswordResetEmail(auth, email.trim(), withUrl ? { url: `${location.origin}/login` } : undefined),
        );
      } catch (e2) {
        // 가입 여부를 드러내지 않도록 네트워크 오류만 알린다
        if (errorKey(e2) === 'errors.network') {
          setError('errors.network');
          return;
        }
      }
      setSent(true);
    });
  }

  return (
    <AuthFrame title={t('reset.title')} subtitle={t('reset.desc')} below={<Link to="/login">{t('reset.back')}</Link>}>
      {sent ? (
        <p className="notice" role="status">
          {t('reset.sent')}
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <EmailField label={t('signup.email')} autoComplete="email" value={email} onValue={setEmail} error={error} />
          <button className="btn btn--primary btn--block" disabled={busy}>
            {t('reset.submit')}
          </button>
        </form>
      )}
    </AuthFrame>
  );
}

type ActionState = 'checking' | 'verified' | 'resetForm' | 'resetDone' | 'recovered' | 'expired' | 'used' | 'invalid';

/**
 * 메일 링크를 눌렀을 때 뜨는 화면 (Firebase 기본 페이지 대신).
 * Firebase 콘솔 → Authentication → 템플릿 → 작업 URL을 이 주소(/auth/action)로 바꿔야 쓰인다.
 */
export function AuthActionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode');
  const code = params.get('oobCode') ?? '';
  const [state, setState] = useState<ActionState>(code ? 'checking' : 'invalid');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const { busy, run } = useLock();
  const ran = useRef(false); // 링크는 한 번만 쓸 수 있어서, 두 번 실행되지 않게

  useEffect(() => {
    if (ran.current || !code) return;
    ran.current = true;
    const fail = (e: unknown) => setState((e as { code?: string }).code === 'auth/expired-action-code' ? 'expired' : 'used');
    if (mode === 'verifyEmail') {
      applyActionCode(auth, code)
        .then(async () => {
          await auth.currentUser?.reload().catch(() => undefined);
          setState('verified');
        })
        .catch(async (e) => {
          // 이미 인증을 마친 링크를 다시 누른 경우는 성공으로 보여 준다
          await auth.currentUser?.reload().catch(() => undefined);
          if (auth.currentUser?.emailVerified) setState('verified');
          else fail(e);
        });
    } else if (mode === 'resetPassword') {
      verifyPasswordResetCode(auth, code)
        .then((em) => {
          setEmail(em);
          setState('resetForm');
        })
        .catch(fail);
    } else if (mode === 'recoverEmail') {
      applyActionCode(auth, code).then(() => setState('recovered')).catch(fail);
    } else setState('invalid');
  }, [code, mode]);

  async function onReset(e: FormEvent) {
    e.preventDefault();
    const err = checkPassword(password);
    if (err) return setPwError(err);
    await run(async () => {
      try {
        await confirmPasswordReset(auth, code, password);
        setState('resetDone');
      } catch (e2) {
        const c = (e2 as { code?: string }).code;
        if (c === 'auth/weak-password') setPwError('errors.passwordShort');
        else setState(c === 'auth/expired-action-code' ? 'expired' : 'used');
      }
    });
  }

  const signedIn = !!auth.currentUser && !auth.currentUser.isAnonymous;
  const isReset = mode === 'resetPassword';

  if (state === 'checking')
    return (
      <AuthFrame title={t('action.checking')}>
        <div className="action-wait" aria-busy="true">
          <span className="action-spinner" />
        </div>
      </AuthFrame>
    );

  if (state === 'resetForm')
    return (
      <AuthFrame title={t('action.resetTitle')} subtitle={t('action.resetDesc', { email })}>
        <form onSubmit={onReset} noValidate>
          <PasswordField
            label={t('action.newPassword')}
            autoComplete="new-password"
            hint={t('signup.passwordHint')}
            value={password}
            showStrength
            onChange={(e) => {
              setPassword(e.target.value);
              setPwError(null);
            }}
            error={pwError ? t(pwError) : undefined}
          />
          <button className="btn btn--primary btn--block btn--lg" disabled={busy || !password}>
            {busy ? t('common.loading') : t('action.resetSubmit')}
          </button>
        </form>
      </AuthFrame>
    );

  const ok = state === 'verified' || state === 'resetDone' || state === 'recovered';
  const title = t(`action.${state}Title`);
  const desc =
    state === 'expired' ? t(isReset ? 'action.expiredDescReset' : 'action.expiredDescVerify') : t(`action.${state}Desc`);

  // 다음에 할 일 버튼
  let primary: { label: string; to: string };
  if (state === 'verified') primary = signedIn ? { label: t('action.goStore'), to: '/inbox' } : { label: t('action.goLogin'), to: '/login' };
  else if (state === 'resetDone' || state === 'recovered') primary = { label: t('action.login'), to: '/login' };
  else if (isReset) primary = { label: t('action.retryReset'), to: '/reset' };
  else primary = { label: t('action.login'), to: signedIn ? '/verify' : '/login' };

  return (
    <AuthFrame title={title} subtitle={desc}>
      <div className="action-result">
        <span className={`action-icon ${ok ? 'action-icon--ok' : 'action-icon--warn'}`} aria-hidden="true">
          {ok ? (
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M12 7v6M12 17h.01" />
            </svg>
          )}
        </span>
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={() => navigate(primary.to, { replace: true })}>
          {primary.label}
        </button>
      </div>
    </AuthFrame>
  );
}
