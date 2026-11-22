import { signOut } from 'firebase/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { RequireOwner, useAuth } from '../app/auth';
import { LanguageSelect, PasswordField, Switch, TextField } from '../components/ui/Fields';
import { ChevronIcon, CloseIcon } from '../components/ui/Icons';
import { Footer, OwnerShell } from '../components/ui/Layout';
import { useToast } from '../components/ui/Overlay';
import { ErrorBox } from '../components/ui/States';
import { StoreIcon } from '../components/ui/StoreIcon';
import { CategoryPicker, TonePicker } from '../components/ui/StorePickers';
import { changePassword, deleteAccount } from '../lib/account';
import { isAdminUser } from '../lib/admin';
import { auth } from '../lib/firebase';
import { errorKey, relativeTime } from '../lib/format';
import { listBlocked, unblock } from '../lib/questions';
import { updateStore, type StoreSettings } from '../lib/stores';
import type { Store } from '../lib/types';
import { checkIntro, checkPassword, checkStoreName, LIMITS } from '../lib/validation';
import { useLock } from '../lib/useLock';

type Section = 'store' | 'words' | 'blocked' | 'account';
const SECTIONS: Section[] = ['store', 'words', 'blocked', 'account'];

export function SettingsPage() {
  return <RequireOwner>{(store) => <Settings store={store} />}</RequireOwner>;
}

/** 설정: 첫 화면은 자주 쓰는 스위치 + 메뉴, 각 항목은 자기 화면으로 */
function Settings({ store }: { store: Store }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const { section } = useParams();

  // 저장은 한 번에 하나만 (연타 · 겹치는 저장 막기)
  const { busy: saving, run } = useLock();
  async function save(patch: Partial<StoreSettings>, quiet = false) {
    await run(async () => {
      const prev = store;
      qc.setQueryData<Store>(['store', store.code], { ...store, ...patch });
      try {
        await updateStore(store.code, patch);
        if (!quiet) toast(t('common.saved'));
      } catch {
        qc.setQueryData<Store>(['store', store.code], prev);
        toast(t('errors.generic'));
      }
    });
  }

  if (section && !SECTIONS.includes(section as Section)) return <Navigate to="/settings" replace />;

  const titles: Record<Section, string> = {
    store: t('settings.storeInfo'),
    words: t('settings.words'),
    blocked: t('settings.blocked'),
    account: t('settings.account'),
  };

  if (section) {
    const s = section as Section;
    return (
      <OwnerShell storeName={store.storeName} back="/settings">
        <main className="page">
          <div className="title-row">
            <h1 className="title">{titles[s]}</h1>
          </div>
          {s === 'store' && <StoreInfo store={store} onSave={save} saving={saving} />}
          {s === 'words' && <BlockedWords store={store} onSave={save} saving={saving} />}
          {s === 'blocked' && <BlockedList code={store.code} />}
          {s === 'account' && <Account store={store} />}
        </main>
      </OwnerShell>
    );
  }

  const Row = ({ to, label, value }: { to: string; label: string; value?: ReactNode }) => (
    <Link to={to} className="menu-row">
      <span>{label}</span>
      {value != null && <span className="menu-row__value">{value}</span>}
      <span style={value == null ? { marginLeft: 'auto' } : undefined}>
        <svg className="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>
    </Link>
  );

  return (
    <OwnerShell storeName={store.storeName} back="/inbox">
      <main className="page page--grow">
        <div className="title-row">
          <h1 className="title">{t('settings.title')}</h1>
        </div>

        <div className="menu-group">
          <div className="switch-row">
            <div className="switch-row__text">
              <p className="switch-row__title">{t('inbox.pauseTitle')}</p>
              <p className="switch-row__desc">{store.acceptingQuestions ? t('inbox.pauseOn') : t('inbox.pauseOff')}</p>
            </div>
            <Switch checked={store.acceptingQuestions} onChange={(v) => save({ acceptingQuestions: v }, true)} label={t('inbox.pauseTitle')} disabled={saving} />
          </div>
        </div>

        <div className="menu-group">
          <Link to="/settings/store" className="menu-row">
            <StoreIcon category={store.category} tone={store.tone} size={36} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600 }}>{store.storeName}</span>
              <span className="subtitle">{t('settings.storeInfoDesc')}</span>
            </span>
            <span style={{ marginLeft: 'auto' }}>
              <ChevronRight />
            </span>
          </Link>
          <Row to="/settings/words" label={t('settings.words')} value={t('settings.wordsCount', { n: store.blockedWords.length })} />
          <Row to="/settings/blocked" label={t('settings.blocked')} />
        </div>

        <div className="menu-group">
          <Row to="/settings/account" label={t('settings.account')} value={auth.currentUser?.email} />
        </div>

        {/* 운영자 계정에만: 매장에 가서 대신 세팅해 주는 화면 */}
        {isAdminUser(auth.currentUser) && (
          <div className="menu-group">
            <Row to="/admin" label="현장 세팅 (운영자)" />
          </div>
        )}

        <div className="grow" />
        <Footer />
      </main>
    </OwnerShell>
  );
}

function ChevronRight() {
  return (
    <span style={{ display: 'inline-flex', transform: 'rotate(-90deg)', color: 'var(--faint)' }}>
      <ChevronIcon />
    </span>
  );
}

/** 가게 정보: 미리보기 + 상호명 · 소개 · 아이콘 · 색, 저장 버튼 하나 */
function StoreInfo({ store, onSave, saving }: { store: Store; onSave: (p: Partial<StoreSettings>) => Promise<void>; saving: boolean }) {
  const { t } = useTranslation();
  const [name, setName] = useState(store.storeName);
  const [intro, setIntro] = useState(store.intro);
  const [category, setCategory] = useState(store.category);
  const [tone, setTone] = useState(store.tone);
  const errs = { name: checkStoreName(name), intro: checkIntro(intro) };
  const dirty = name.trim() !== store.storeName || intro.trim() !== store.intro || category !== store.category || tone !== store.tone;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!saving && dirty && !errs.name && !errs.intro) onSave({ storeName: name.trim(), intro: intro.trim(), category, tone });
      }}
    >
      <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <StoreIcon category={category} tone={tone} size={56} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 18 }}>{name.trim() || ' '}</p>
          <p className="subtitle">{intro.trim() || t('settings.introHint')}</p>
        </div>
      </div>

      <TextField
        label={t('settings.storeName')}
        value={name}
        maxLength={LIMITS.storeName}
        onChange={(e) => setName(e.target.value)}
        error={errs.name}
        hint={`${name.trim().length} / ${LIMITS.storeName}`}
      />
      <TextField
        label={t('settings.intro')}
        value={intro}
        maxLength={LIMITS.intro}
        onChange={(e) => setIntro(e.target.value)}
        error={errs.intro}
        hint={`${intro.trim().length} / ${LIMITS.intro}`}
      />

      <div className="field">
        <span className="field__label">{t('signup.category')}</span>
        <CategoryPicker value={category} onChange={(c) => setCategory(c ?? 'other')} label={t('signup.category')} />
      </div>
      <div className="field">
        <span className="field__label">{t('settings.tone')}</span>
        <TonePicker value={tone} onChange={setTone} label={t('settings.tone')} />
      </div>

      {/* 바뀐 게 있을 때만 누를 수 있고, 저장 중에는 잠근다 */}
      <button className="btn btn--primary btn--block" disabled={saving || !dirty || !!errs.name || !!errs.intro}>
        {saving ? t('common.saving') : t('common.save')}
      </button>
    </form>
  );
}

function BlockedWords({ store, onSave, saving }: { store: Store; onSave: (p: Partial<StoreSettings>) => Promise<void>; saving: boolean }) {
  const { t } = useTranslation();
  const [word, setWord] = useState('');
  const words = store.blockedWords;
  const full = words.length >= LIMITS.blockedWords;
  function add(e: FormEvent) {
    e.preventDefault();
    const w = word.trim().slice(0, LIMITS.blockedWordLength);
    if (saving) return;
    if (!w || full || words.includes(w)) return setWord('');
    onSave({ blockedWords: [...words, w] });
    setWord('');
  }
  return (
    <>
      <p className="subtitle" style={{ marginBottom: 16 }}>
        {t('settings.wordsDesc')}
      </p>
      <form className="input-group" onSubmit={add}>
        <input className="input" value={word} maxLength={LIMITS.blockedWordLength} placeholder={t('settings.wordsPlaceholder')} aria-label={t('settings.wordsPlaceholder')} onChange={(e) => setWord(e.target.value)} disabled={full} />
        <button className="btn" disabled={saving || full || !word.trim()}>
          {t('settings.wordsAdd')}
        </button>
      </form>
      <p className="field__hint num" style={{ marginTop: 8 }}>
        {t('settings.wordsLimit', { n: words.length })}
      </p>
      {words.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {words.map((w) => (
            <li key={w} className="chip" style={{ paddingRight: 2, color: 'var(--text)' }}>
              {w}
              <button className="icon-btn" style={{ width: 28, height: 28 }} aria-label={t('settings.wordsRemove', { w })} disabled={saving} onClick={() => onSave({ blockedWords: words.filter((x) => x !== w) })}>
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function BlockedList({ code }: { code: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const q = useQuery({ queryKey: ['blocked', code], queryFn: () => listBlocked(code), staleTime: 5 * 60_000 });
  const { busy, run } = useLock();
  return (
    <>
      {q.isError && <ErrorBox onRetry={() => q.refetch()} />}
      {q.isLoading && <div className="skeleton" style={{ height: 56 }} />}
      {q.data?.length === 0 && <div className="empty">{t('settings.blockedEmpty')}</div>}
      {!!q.data?.length && (
        <ul className="menu-group" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {q.data.map((b) => (
            <li key={b.uid} className="menu-row" style={{ cursor: 'default' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>“{b.snippet}”</p>
                <p className="field__hint">{relativeTime(b.at)}</p>
              </div>
              <button
                className="btn btn--sm"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await unblock(code, b.uid).catch(() => toast(t('errors.generic')));
                    await q.refetch();
                  })
                }
              >
                {t('settings.unblock')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
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
  const { busy, run } = useLock();

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    const err = checkPassword(next);
    if (err) return setPwError(err);
    await run(async () => {
      try {
        await changePassword(user!, cur, next);
        setCur('');
        setNext('');
        setPwError(null);
        toast(t('settings.passwordChanged'));
      } catch (e2) {
        setPwError(errorKey(e2) === 'errors.wrongLogin' ? 'errors.wrongPassword' : errorKey(e2));
      }
    });
  }

  async function onDelete(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      try {
        await deleteAccount(user!, delPw, store.code);
        navigate('/', { replace: true });
      } catch (e2) {
        setDelError(errorKey(e2) === 'errors.wrongLogin' ? 'errors.wrongPassword' : errorKey(e2));
      }
    });
  }

  return (
    <>
      <div className="menu-group">
        <div className="menu-row" style={{ cursor: 'default' }}>
          <span>{t('settings.email')}</span>
          <span className="menu-row__value">{user?.email}</span>
        </div>
        <div className="menu-row" style={{ cursor: 'default' }}>
          <span>{t('lang.label')}</span>
          <span style={{ marginLeft: 'auto' }}>
            <LanguageSelect />
          </span>
        </div>
        <button className="menu-row" disabled={busy} onClick={() => run(() => signOut(auth).then(() => navigate('/')))}>
          {t('settings.logout')}
        </button>
      </div>

      <section className="section" aria-labelledby="pw-h">
        <h2 id="pw-h" className="section__title">
          {t('settings.changePassword')}
        </h2>
        <form className="panel" onSubmit={onChangePassword} noValidate>
          <PasswordField label={t('settings.currentPassword')} autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
          <PasswordField label={t('settings.newPassword')} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} hint={t('signup.passwordHint')} error={pwError} showStrength />
          <button className="btn btn--ink btn--sm" disabled={busy || !cur || !next}>
            {t('settings.changePassword')}
          </button>
        </form>
      </section>

      <section className="section" aria-labelledby="delete-h">
        <details>
          <summary className="section__title" id="delete-h" style={{ color: 'var(--negative)', cursor: 'pointer' }}>
            {t('settings.deleteTitle')}
          </summary>
          <form className="panel" onSubmit={onDelete} noValidate style={{ marginTop: 8 }}>
            <p className="subtitle" style={{ marginBottom: 16 }}>
              {t('settings.deleteDesc')}
            </p>
            <PasswordField label={t('settings.deleteConfirm')} autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} error={delError} />
            <button className="btn btn--danger btn--sm" disabled={busy || !delPw}>
              {busy ? t('settings.deleting') : t('settings.deleteButton')}
            </button>
          </form>
        </details>
      </section>
    </>
  );
}
