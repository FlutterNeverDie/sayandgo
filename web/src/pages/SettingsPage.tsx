import { signOut } from 'firebase/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { RequireOwner, useAuth } from '../app/auth';
import { LanguageSelect, PasswordField, Switch, TextField } from '../components/ui/Fields';
import { CloseIcon } from '../components/ui/Icons';
import { OwnerShell } from '../components/ui/Layout';
import { useToast } from '../components/ui/Overlay';
import { ErrorBox } from '../components/ui/States';
import { changePassword, deleteAccount } from '../lib/account';
import { auth } from '../lib/firebase';
import { errorKey, relativeTime } from '../lib/format';
import { listBlocked, unblock } from '../lib/questions';
import { updateStore, type StoreSettings } from '../lib/stores';
import type { Store } from '../lib/types';
import { checkIntro, checkPassword, checkStoreName, LIMITS } from '../lib/validation';

export function SettingsPage() {
  return <RequireOwner>{(store) => <Settings store={store} />}</RequireOwner>;
}

function Settings({ store }: { store: Store }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();

  async function save(patch: Partial<StoreSettings>) {
    const prev = store;
    qc.setQueryData<Store>(['store', store.code], { ...store, ...patch });
    try {
      await updateStore(store.code, patch);
      toast(t('common.saved'));
    } catch {
      qc.setQueryData<Store>(['store', store.code], prev);
      toast(t('errors.generic'));
    }
  }

  return (
    <OwnerShell storeName={store.storeName}>
      <main className="page">
        <div className="title-row">
          <h1 className="title">{t('settings.title')}</h1>
        </div>
        <StoreInfo store={store} onSave={save} />
        <section className="section">
          <div className="panel" style={{ padding: '0 16px' }}>
            <div className="switch-row">
              <div className="switch-row__text">
                <p className="switch-row__title">{t('settings.showUnanswered')}</p>
                <p className="switch-row__desc">{store.showUnanswered ? t('settings.showUnansweredOn') : t('settings.showUnansweredOff')}</p>
              </div>
              <Switch checked={store.showUnanswered} onChange={(v) => save({ showUnanswered: v })} label={t('settings.showUnanswered')} />
            </div>
          </div>
        </section>
        <BlockedWords store={store} onSave={save} />
        <BlockedList code={store.code} />
        <Account store={store} />
      </main>
    </OwnerShell>
  );
}

function StoreInfo({ store, onSave }: { store: Store; onSave: (p: Partial<StoreSettings>) => Promise<void> }) {
  const { t } = useTranslation();
  const [name, setName] = useState(store.storeName);
  const [intro, setIntro] = useState(store.intro);
  const errs = { name: checkStoreName(name), intro: checkIntro(intro) };
  const dirty = name.trim() !== store.storeName || intro.trim() !== store.intro;
  return (
    <section aria-labelledby="store-h">
      <h2 id="store-h" className="section__title">
        {t('settings.store')}
      </h2>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (!errs.name && !errs.intro) onSave({ storeName: name.trim(), intro: intro.trim() });
        }}
      >
        <TextField label={t('settings.storeName')} value={name} maxLength={LIMITS.storeName} onChange={(e) => setName(e.target.value)} error={errs.name} />
        <TextField label={t('settings.intro')} value={intro} maxLength={LIMITS.intro} onChange={(e) => setIntro(e.target.value)} error={errs.intro} hint={t('settings.introHint')} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn--primary btn--sm" disabled={!dirty || !!errs.name || !!errs.intro}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </section>
  );
}

function BlockedWords({ store, onSave }: { store: Store; onSave: (p: Partial<StoreSettings>) => Promise<void> }) {
  const { t } = useTranslation();
  const [word, setWord] = useState('');
  const words = store.blockedWords;
  const full = words.length >= LIMITS.blockedWords;
  function add(e: FormEvent) {
    e.preventDefault();
    const w = word.trim().slice(0, LIMITS.blockedWordLength);
    if (!w || full || words.includes(w)) return setWord('');
    onSave({ blockedWords: [...words, w] });
    setWord('');
  }
  return (
    <section className="section" aria-labelledby="words-h">
      <h2 id="words-h" className="section__title">
        {t('settings.words')}
      </h2>
      <div className="panel">
        <p className="subtitle" style={{ marginBottom: 12 }}>
          {t('settings.wordsDesc')}
        </p>
        <form className="input-group" onSubmit={add}>
          <input className="input" value={word} maxLength={LIMITS.blockedWordLength} placeholder={t('settings.wordsPlaceholder')} aria-label={t('settings.wordsPlaceholder')} onChange={(e) => setWord(e.target.value)} disabled={full} />
          <button className="btn" disabled={full || !word.trim()}>
            {t('settings.wordsAdd')}
          </button>
        </form>
        <p className="field__hint num" style={{ marginTop: 8 }}>
          {t('settings.wordsLimit', { n: words.length })}
        </p>
        {words.length > 0 && (
          <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {words.map((w) => (
              <li key={w} className="pill pill--hidden" style={{ height: 32, paddingRight: 2, fontSize: 14 }}>
                {w}
                <button className="icon-btn" style={{ width: 28, height: 28 }} aria-label={t('settings.wordsRemove', { w })} onClick={() => onSave({ blockedWords: words.filter((x) => x !== w) })}>
                  <CloseIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function BlockedList({ code }: { code: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const q = useQuery({ queryKey: ['blocked', code], queryFn: () => listBlocked(code), staleTime: 5 * 60_000 });
  return (
    <section className="section" aria-labelledby="blocked-h">
      <h2 id="blocked-h" className="section__title">
        {t('settings.blocked')}
      </h2>
      {q.isError && <ErrorBox onRetry={() => q.refetch()} />}
      {q.isLoading && <div className="skeleton" style={{ height: 56 }} />}
      {q.data?.length === 0 && <div className="empty">{t('settings.blockedEmpty')}</div>}
      {!!q.data?.length && (
        <ul className="panel divided" style={{ listStyle: 'none', margin: 0, padding: '0 16px' }}>
          {q.data.map((b) => (
            <li key={b.uid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>“{b.snippet}”</p>
                <p className="field__hint">{relativeTime(b.at)}</p>
              </div>
              <button
                className="btn btn--sm"
                onClick={async () => {
                  await unblock(code, b.uid).catch(() => toast(t('errors.generic')));
                  q.refetch();
                }}
              >
                {t('settings.unblock')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Account({ store }: { store: Store }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [delPw, setDelPw] = useState('');
  const [delError, setDelError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    const err = checkPassword(next);
    if (err) return setPwError(err);
    setBusy(true);
    try {
      await changePassword(user!, cur, next);
      setCur('');
      setNext('');
      setPwError(null);
      toast(t('settings.passwordChanged'));
    } catch (e2) {
      setPwError(errorKey(e2) === 'errors.wrongLogin' ? 'errors.wrongPassword' : errorKey(e2));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await deleteAccount(user!, delPw, store.code);
      navigate('/', { replace: true });
    } catch (e2) {
      setDelError(errorKey(e2) === 'errors.wrongLogin' ? 'errors.wrongPassword' : errorKey(e2));
      setBusy(false);
    }
  }

  return (
    <>
      <section className="section" aria-labelledby="account-h">
        <h2 id="account-h" className="section__title">
          {t('settings.account')}
        </h2>
        <div className="panel divided" style={{ padding: '0 16px' }}>
          <div style={{ padding: '14px 0' }}>
            <p className="field__hint">{t('settings.email')}</p>
            <p>{user?.email}</p>
          </div>
          <div style={{ padding: '10px 0', display: 'flex', alignItems: 'center' }}>
            <span style={{ flex: 1 }}>{t('lang.label')}</span>
            <LanguageSelect />
          </div>
          <details style={{ padding: '14px 0' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t('settings.changePassword')}</summary>
            <form onSubmit={onChangePassword} style={{ marginTop: 16 }} noValidate>
              <PasswordField label={t('settings.currentPassword')} autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
              <PasswordField label={t('settings.newPassword')} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} hint={t('signup.passwordHint')} error={pwError} showStrength />
              <button className="btn btn--ink btn--sm" disabled={busy || !cur || !next}>
                {t('settings.changePassword')}
              </button>
            </form>
          </details>
          <div style={{ padding: '10px 0' }}>
            <button className="btn btn--text" style={{ paddingLeft: 0 }} onClick={() => signOut(auth).then(() => navigate('/'))}>
              {t('settings.logout')}
            </button>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="delete-h">
        <h2 id="delete-h" className="section__title" style={{ color: 'var(--negative)' }}>
          {t('settings.deleteTitle')}
        </h2>
        <form className="panel" onSubmit={onDelete} noValidate>
          <p className="subtitle" style={{ marginBottom: 16 }}>
            {t('settings.deleteDesc')}
          </p>
          <PasswordField label={t('settings.deleteConfirm')} autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} error={delError} />
          <button className="btn btn--danger btn--sm" disabled={busy || !delPw}>
            {busy ? t('settings.deleting') : t('settings.deleteButton')}
          </button>
        </form>
      </section>
    </>
  );
}
