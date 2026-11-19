import { sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/auth';
import { PasswordField, TextField } from '../components/ui/Fields';
import { PublicTopbar } from '../components/ui/Layout';
import { Loading } from '../components/ui/States';
import { currentLang } from '../i18n';
import { auth } from '../lib/firebase';
import { errorKey } from '../lib/format';
import { signUp, verifyActionSettings } from '../lib/stores';
import { checkEmail, checkPassword, checkStoreName, LIMITS } from '../lib/validation';

function AuthFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <PublicTopbar />
      <main className="page page--narrow">
        <div className="title-row">
          <h1 className="title">{title}</h1>
        </div>
        {children}
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
  const [agree, setAgree] = useState({ age14: false, terms: false, privacy: false });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const errs = { email: checkEmail(email), password: checkPassword(password), storeName: checkStoreName(storeName) };
  const show = (k: keyof typeof errs) => (submitted || touched[k] ? errs[k] : null);
  const allAgreed = agree.age14 && agree.terms && agree.privacy;
  const blur = (k: string) => () => setTouched((s) => ({ ...s, [k]: true }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);
    if (errs.email || errs.password || errs.storeName) return;
    if (!allAgreed) return setFormError('errors.agreeRequired');
    setBusy(true);
    try {
      await signUp({ email, password, storeName, lang: currentLang() });
      navigate('/verify', { replace: true });
    } catch (err) {
      setFormError(errorKey(err));
      setBusy(false);
    }
  }

  return (
    <AuthFrame title={t('signup.title')}>
      <form onSubmit={onSubmit} noValidate>
        <TextField
          label={t('signup.email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
        <button className="btn btn--primary btn--block" disabled={busy}>
          {busy ? t('common.loading') : t('signup.submit')}
        </button>
        <p className="subtitle" style={{ marginTop: 20, textAlign: 'center' }}>
          {t('signup.haveAccount')} <Link to="/login">{t('login.title')}</Link>
        </p>
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
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const from = (location.state as { from?: string } | null)?.from ?? '/inbox';

  if (ready && user) return <Navigate to={user.emailVerified ? from : '/verify'} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (checkEmail(email) || !password) return setFormError('errors.wrongLogin');
    setBusy(true);
    try {
      const { user: u } = await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate(u.emailVerified ? from : '/verify', { replace: true });
    } catch (err) {
      setFormError(errorKey(err));
      setBusy(false);
    }
  }

  return (
    <AuthFrame title={t('login.title')}>
      <form onSubmit={onSubmit} noValidate>
        <TextField label={t('signup.email')} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField label={t('signup.password')} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {formError && (
          <p className="field__error" role="alert" style={{ marginBottom: 12 }}>
            {t(formError)}
          </p>
        )}
        <button className="btn btn--primary btn--block" disabled={busy}>
          {busy ? t('common.loading') : t('login.submit')}
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, fontSize: 14 }}>
          <Link to="/reset">{t('login.forgot')}</Link>
          <span className="subtitle">
            {t('login.noAccount')} <Link to="/signup">{t('signup.title')}</Link>
          </span>
        </div>
      </form>
    </AuthFrame>
  );
}

const RESEND_KEY = 'qplace:verifySentAt';

export function VerifyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState<string | null>(null);
  const sentAt = Number(sessionStorage.getItem(RESEND_KEY) ?? 0) || 0;
  const wait = Math.max(0, 60 - Math.floor((now - sentAt) / 1000));

  useEffect(() => {
    if (!sessionStorage.getItem(RESEND_KEY)) sessionStorage.setItem(RESEND_KEY, String(Date.now()));
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // 다른 탭에서 링크를 눌렀을 수 있으니 화면이 보일 때 4초마다 확인
  useEffect(() => {
    if (!user) return;
    const check = async () => {
      if (document.hidden) return;
      await user.reload().catch(() => undefined);
      if (auth.currentUser?.emailVerified) navigate('/inbox', { replace: true });
    };
    const timer = setInterval(check, 4000);
    return () => clearInterval(timer);
  }, [user, navigate]);

  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.emailVerified) return <Navigate to="/inbox" replace />;

  async function resend() {
    if (!user) return;
    try {
      auth.languageCode = currentLang();
      await sendEmailVerification(user, verifyActionSettings());
      sessionStorage.setItem(RESEND_KEY, String(Date.now()));
      setNow(Date.now());
      setMessage(t('verify.resent'));
    } catch (err) {
      setMessage(t(errorKey(err)));
    }
  }

  async function checkNow() {
    await user!.reload().catch(() => undefined);
    if (auth.currentUser?.emailVerified) navigate('/inbox', { replace: true });
    else setMessage(t('verify.notYet'));
  }

  return (
    <AuthFrame title={t('verify.title')}>
      <p style={{ marginBottom: 8 }}>{t('verify.desc', { email: user.email })}</p>
      <p className="subtitle" style={{ marginBottom: 24 }}>
        {t('verify.spam')}
      </p>
      <div style={{ display: 'grid', gap: 8 }}>
        <button className="btn btn--primary btn--block" onClick={checkNow}>
          {t('verify.check')}
        </button>
        <button className="btn btn--block" onClick={resend} disabled={wait > 0}>
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const err = checkEmail(email);
    if (err) return setError(err);
    setBusy(true);
    try {
      auth.languageCode = currentLang();
      await sendPasswordResetEmail(auth, email.trim(), { url: `${location.origin}/login` });
    } catch (e2) {
      // 가입 여부를 드러내지 않도록 네트워크 오류만 알린다
      if (errorKey(e2) === 'errors.network') {
        setError('errors.network');
        setBusy(false);
        return;
      }
    }
    setSent(true);
    setBusy(false);
  }

  return (
    <AuthFrame title={t('reset.title')}>
      {sent ? (
        <p className="notice" role="status">
          {t('reset.sent')}
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <p className="subtitle" style={{ marginBottom: 20 }}>
            {t('reset.desc')}
          </p>
          <TextField label={t('signup.email')} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          <button className="btn btn--primary btn--block" disabled={busy}>
            {t('reset.submit')}
          </button>
        </form>
      )}
      <p style={{ marginTop: 20 }}>
        <Link to="/login">{t('reset.back')}</Link>
      </p>
    </AuthFrame>
  );
}
