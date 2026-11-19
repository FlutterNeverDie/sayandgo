import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BackIcon, LockIcon } from '../components/ui/Icons';
import { useToast } from '../components/ui/Overlay';
import { Loading } from '../components/ui/States';
import { currentLang } from '../i18n';
import { postQuestion } from '../lib/questions';
import { CODE_RE } from '../lib/storeCode';
import { getStore } from '../lib/stores';
import { QUESTION_KINDS, type QuestionKind, type Store } from '../lib/types';
import { checkQuestion, LIMITS, tidyText } from '../lib/validation';

const LAST_POST_KEY = 'sayandgo:lastPost';
const WAIT_SEC = 30;

function readLastPost(): number {
  try {
    return Number(localStorage.getItem(LAST_POST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** 피드백 쓰기: 전체 화면 페이지. 브라우저 뒤로 가기 = 가게 페이지로 돌아가기 */
export function ComposePage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromStore = (location.state as { fromStore?: boolean } | null)?.fromStore === true;
  const valid = CODE_RE.test(code);
  // 가게 페이지에서 넘어왔다면 캐시에 있어 다시 읽지 않는다
  const storeQuery = useQuery({ queryKey: ['store', code], queryFn: () => getStore(code), enabled: valid, staleTime: 10 * 60_000 });

  const goBack = () => (fromStore ? navigate(-1) : navigate(`/q/${code}`, { replace: true }));

  if (valid && storeQuery.isLoading) return <Loading />;
  const store = storeQuery.data;
  if (!valid || !store || store.status !== 'active' || !store.acceptingQuestions) return <Navigate to={`/q/${code}`} replace />;
  return <ComposeForm store={store} onBack={goBack} />;
}

function ComposeForm({ store, onBack }: { store: Store; onBack: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const draftKey = `sayandgo:draft:${store.code}`;
  const [text, setText] = useState(() => sessionStorage.getItem(draftKey) ?? '');
  const [kind, setKind] = useState<QuestionKind>('question');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const ref = useRef<HTMLTextAreaElement>(null);
  const wait = Math.max(0, WAIT_SEC - Math.floor((now - readLastPost()) / 1000));

  useEffect(() => {
    window.scrollTo(0, 0);
    ref.current?.focus({ preventScroll: true }); // 페이지를 끌어내리지 않고 커서만
    document.title = `${t('store.askTitle')} · ${store.storeName}`;
  }, [t, store.storeName]);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [wait]);

  useEffect(() => {
    sessionStorage.setItem(draftKey, text);
  }, [draftKey, text]);

  const length = text.trim().length;
  const canSend = !busy && wait <= 0 && length >= LIMITS.questionMin;

  async function onSubmit(e?: FormEvent) {
    e?.preventDefault();
    const body = tidyText(text);
    const err = checkQuestion(body, store.blockedWords);
    setError(err);
    if (err || wait > 0) return;
    setBusy(true);
    try {
      await postQuestion(store.code, body, currentLang(), kind, 'public');
      try {
        localStorage.setItem(LAST_POST_KEY, String(Date.now()));
      } catch {
        /* 무시 */
      }
      sessionStorage.removeItem(draftKey);
      toast(t('store.sentHidden'), { ms: 3600 });
      onBack();
    } catch (e2) {
      const code = (e2 as { code?: string }).code;
      setError(code === 'unavailable' ? 'errors.network' : 'errors.cantPost');
      setBusy(false);
    }
  }

  return (
    <>
      <header className="compose-bar">
        <button className="icon-btn" onClick={onBack} aria-label={t('common.back')} style={{ marginLeft: -10 }}>
          <BackIcon />
        </button>
        <div className="compose-bar__title">
          <h1>{t('store.askTitle')}</h1>
          <span>{store.storeName}</span>
        </div>
      </header>

      <main className="page compose">
        <form onSubmit={onSubmit} noValidate>
          <div className="kind-chips" role="radiogroup" aria-label={t('store.label')}>
            {QUESTION_KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}>
                {t(`kind.${k}`)}
              </button>
            ))}
          </div>

          <label htmlFor="q-body" className="sr-only">
            {t('store.label')}
          </label>
          <textarea
            id="q-body"
            ref={ref}
            className="compose__text"
            maxLength={LIMITS.questionMax + 50}
            placeholder={t(`kindPlaceholder.${kind}`)}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={!!error}
            aria-describedby="q-err q-hint"
          />
          <div className="compose__meta">
            {error ? (
              <p className="field__error" id="q-err" role="alert">
                {t(error)}
              </p>
            ) : (
              <span className="no-delete" style={{ margin: 0, textAlign: 'left' }}>
                {wait > 0 ? t('store.wait', { s: wait }) : t('store.noDelete')}
              </span>
            )}
            <span className="num" style={{ color: length > LIMITS.questionMax ? 'var(--negative)' : 'var(--faint)' }}>
              {length} / {LIMITS.questionMax}
            </span>
          </div>

          <button className="btn btn--black btn--block btn--lg" style={{ marginTop: 16 }} disabled={!canSend}>
            {busy ? t('store.sending') : wait > 0 ? t('store.wait', { s: wait }) : t('store.send')}
          </button>

          <div className="anon-box">
            <p className="anon-box__title">
              <LockIcon />
              {t('store.anonTitle')}
            </p>
            <ul>
              <li>{t('store.anon1')}</li>
              <li>{t('store.anon2')}</li>
              <li>{t('store.anon3')}</li>
            </ul>
          </div>

          <p className="field__hint" id="q-hint" style={{ marginTop: 12 }}>
            <Trans i18nKey="store.consent" components={{ 1: <Link to="/policy" /> }} />
          </p>
        </form>
      </main>
    </>
  );
}
