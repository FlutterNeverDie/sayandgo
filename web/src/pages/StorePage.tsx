import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { QuestionItem } from '../components/question/QuestionItem';
import { StoreHeader, useScrolledPast } from '../components/question/StoreHeader';
import { ReportSheet } from '../components/question/ReportSheet';
import { Footer, PublicTopbar } from '../components/ui/Layout';
import { Sheet, useToast } from '../components/ui/Overlay';
import { Switch } from '../components/ui/Fields';
import { LockIcon, ShareIcon } from '../components/ui/Icons';
import { ErrorBox, Loading, TicketSkeleton } from '../components/ui/States';
import { currentLang } from '../i18n';
import {
  alreadyReported,
  deleteMyQuestion,
  fetchAnsweredCount,
  fetchPublicPage,
  myQuestionIds,
  postQuestion,
  reportQuestion,
  reportStore,
  type Page,
} from '../lib/questions';
import { CODE_RE, storeUrl } from '../lib/storeCode';
import { getStore } from '../lib/stores';
import { QUESTION_KINDS, type Question, type QuestionKind, type Store } from '../lib/types';
import { checkQuestion, LIMITS, tidyText } from '../lib/validation';

const LAST_POST_KEY = 'qplace:lastPost';
const WAIT_SEC = 30;

export function StorePage() {
  const { code = '' } = useParams();
  const { t } = useTranslation();
  const valid = CODE_RE.test(code);
  const storeQuery = useQuery({
    queryKey: ['store', code],
    queryFn: () => getStore(code),
    enabled: valid,
    staleTime: 10 * 60_000, // 상호명은 거의 안 바뀐다
  });

  if (valid && storeQuery.isLoading) return <><PublicTopbar /><Loading /></>;
  if (storeQuery.isError) return <><PublicTopbar /><Loading error onRetry={() => storeQuery.refetch()} /></>;
  const store = storeQuery.data;
  if (!valid || !store) return <StoreState title={t('store.notFoundTitle')} desc={t('store.notFoundDesc')} />;
  if (store.status === 'pending') return <StoreState title={t('store.pendingTitle')} desc={t('store.pendingDesc')} />;
  if (store.status === 'deleted') return <StoreState title={t('store.deletedTitle')} desc={t('store.deletedDesc')} />;
  if (store.status === 'suspended') return <StoreState title={t('store.suspendedTitle')} desc={t('store.suspendedDesc')} />;
  return <ActiveStore store={store} />;
}

function StoreState({ title, desc }: { title: string; desc: string }) {
  return (
    <>
      <PublicTopbar />
      <main className="page">
        <div className="center-state">
          <h1>{title}</h1>
          <p>{desc}</p>
        </div>
        <Footer />
      </main>
    </>
  );
}

function ActiveStore({ store }: { store: Store }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const listKey = ['public', store.code];
  const [mine, setMine] = useState(() => myQuestionIds(store.code));
  const [composing, setComposing] = useState(false);
  const [menuFor, setMenuFor] = useState<Question | null>(null);
  const [reporting, setReporting] = useState<Question | 'store' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Question | null>(null);

  useEffect(() => {
    document.title = `${store.storeName} · ${t('app.name')}`;
  }, [store.storeName, t]);

  const [headerRef, past] = useScrolledPast<HTMLElement>();
  const answered = useQuery({ queryKey: ['answered', store.code], queryFn: () => fetchAnsweredCount(store.code), staleTime: 10 * 60_000 });

  // 사장님이 답변한 공개 글만, 10개씩, 60초 캐시, 실시간 구독 없음 (읽기 절감)
  const list = useInfiniteQuery({
    queryKey: listKey,
    queryFn: ({ pageParam }) => fetchPublicPage(store.code, pageParam),
    initialPageParam: null as Page['cursor'],
    getNextPageParam: (last) => last.cursor ?? undefined,
    staleTime: 60_000,
  });
  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);

  // 끝에 닿으면 다음 10개 (손님이 실제로 내려 볼 때만 읽는다)
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && fetchNextPage(), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  function onPosted(q: Question) {
    setComposing(false);
    setMine(myQuestionIds(store.code));
    // 답변 전 글은 공개되지 않으므로 목록은 그대로 (읽기 0)
    toast(q.visibility === 'owner' ? t('store.sentPrivate') : t('store.sentHidden'), { ms: 3600 });
  }

  async function onDeleteMine(q: Question) {
    setConfirmDelete(null);
    try {
      await deleteMyQuestion(store.code, q.id);
      qc.setQueryData<InfiniteData<Page>>(listKey, (old) =>
        old ? { ...old, pages: old.pages.map((p) => ({ ...p, items: p.items.filter((i) => i.id !== q.id) })) } : old,
      );
      setMine(myQuestionIds(store.code));
      toast(t('store.deletedMine'));
    } catch {
      toast(t('errors.generic'));
    }
  }

  async function onReport(reason: Parameters<typeof reportStore>[1], detail: string) {
    const target = reporting;
    try {
      if (target === 'store') await reportStore(store.code, reason, detail);
      else if (target) await reportQuestion(store.code, target, reason, detail);
      toast(t('report.done'));
    } catch {
      toast(t('report.already'));
    }
    setReporting(null);
  }

  const url = storeUrl(store.code);

  return (
    <>
      <PublicTopbar
        title={store.storeName}
        showTitle={past}
        end={
          'share' in navigator ? (
            <button className="icon-btn" aria-label={t('store.shareStore')} onClick={() => navigator.share({ title: store.storeName, url }).catch(() => undefined)}>
              <ShareIcon />
            </button>
          ) : undefined
        }
      />
      <main className="page" style={{ paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>
        <StoreHeader
          headerRef={headerRef}
          store={store}
          intro={store.intro}
          chips={
            <>
              <span className="chip" style={{ color: 'var(--mint-ink)', fontWeight: 700 }}>
                <LockIcon />
                {t('store.anonBadge')}
              </span>
              {answered.data != null && answered.data > 0 && (
                <span className="chip num">
                  {t('store.statsA')} <b>{answered.data}</b>
                </span>
              )}
              {!store.acceptingQuestions && <span className="chip chip--paused">{t('store.pausedChip')}</span>}
            </>
          }
        />

        <section className="feed" aria-label={t('store.listTitle')} style={{ marginTop: 12 }}>
          {list.isLoading && (
            <>
              <TicketSkeleton />
              <TicketSkeleton />
              <TicketSkeleton />
            </>
          )}
          {list.isError && (
            <div style={{ padding: 16 }}>
              <ErrorBox onRetry={() => list.refetch()} />
            </div>
          )}
          {list.isSuccess && items.length === 0 && (
            <div className="center-state panel" style={{ padding: '40px 16px' }}>
              <h2 style={{ fontSize: 16 }}>{t('store.emptyTitle')}</h2>
              <p>{t('store.emptyDesc')}</p>
            </div>
          )}
          {items.map((q) => (
            <QuestionItem key={q.id} q={q} store={store} mine={mine.has(q.id)} onMenu={() => setMenuFor(q)} />
          ))}
          <div ref={sentinel} />
          {list.isFetchingNextPage && <TicketSkeleton />}
          {list.isSuccess && items.length > 0 && !list.hasNextPage && (
            <p className="subtitle" style={{ textAlign: 'center', padding: '24px 0 0' }}>
              {t('store.end')}
            </p>
          )}
        </section>

        <Footer
          extra={
            <>
              <button onClick={() => setReporting('store')}>{t('store.reportStore')}</button>
              <Link to="/">{t('store.powered')}</Link>
            </>
          }
        />
      </main>

      <div className="cta-bar">
        <div className="cta-bar__inner">
          {store.acceptingQuestions ? (
            <button className="btn btn--primary" onClick={() => setComposing(true)}>
              {t('store.ask')}
            </button>
          ) : (
            <p className="notice">{t('store.paused')}</p>
          )}
        </div>
      </div>

      {composing && <ComposeSheet store={store} onClose={() => setComposing(false)} onPosted={onPosted} />}

      {menuFor && (
        <Sheet onClose={() => setMenuFor(null)}>
          <div className="menu-list">
            {mine.has(menuFor.id) && (
              <button
                className="danger"
                onClick={() => {
                  setConfirmDelete(menuFor);
                  setMenuFor(null);
                }}
              >
                {t('store.deleteMine')}
              </button>
            )}
            <button
              onClick={() => {
                const q = menuFor;
                setMenuFor(null);
                if (alreadyReported(q.id)) toast(t('report.already'));
                else setReporting(q);
              }}
            >
              {t('store.report')}
            </button>
            <button onClick={() => setMenuFor(null)}>{t('common.cancel')}</button>
          </div>
        </Sheet>
      )}

      {confirmDelete && (
        <Sheet title={t('store.deleteMine')} desc={t('store.deleteMineConfirm')} onClose={() => setConfirmDelete(null)}>
          <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setConfirmDelete(null)}>
              {t('common.cancel')}
            </button>
            <button className="btn btn--ink" onClick={() => onDeleteMine(confirmDelete)}>
              {t('common.delete')}
            </button>
          </div>
        </Sheet>
      )}

      {reporting && <ReportSheet onClose={() => setReporting(null)} onSubmit={onReport} />}
    </>
  );
}

function readLastPost(): number {
  try {
    return Number(localStorage.getItem(LAST_POST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** 남기기: 종류 고르기 + 사장님만 보기 + 익명 안내. 버튼을 눌렀을 때만 열린다. */
function ComposeSheet({ store, onClose, onPosted }: { store: Store; onClose: () => void; onPosted: (q: Question) => void }) {
  const { t } = useTranslation();
  const draftKey = `qplace:draft:${store.code}`;
  const [text, setText] = useState(() => sessionStorage.getItem(draftKey) ?? '');
  const [kind, setKind] = useState<QuestionKind>('question');
  const [ownerOnly, setOwnerOnly] = useState(false);
  const [touchedPrivate, setTouchedPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const ref = useRef<HTMLTextAreaElement>(null);
  const wait = Math.max(0, WAIT_SEC - Math.floor((now - readLastPost()) / 1000));

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [wait]);

  useEffect(() => {
    sessionStorage.setItem(draftKey, text);
  }, [draftKey, text]);

  function pickKind(k: QuestionKind) {
    setKind(k);
    // 아쉬운 점은 기본으로 사장님만 (직접 바꿨으면 그대로 둔다)
    if (!touchedPrivate) setOwnerOnly(k === 'complaint');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = tidyText(text);
    const err = checkQuestion(body, store.blockedWords);
    setError(err);
    if (err || wait > 0) return;
    setBusy(true);
    try {
      const q = await postQuestion(store.code, body, currentLang(), kind, ownerOnly ? 'owner' : 'public');
      try {
        localStorage.setItem(LAST_POST_KEY, String(Date.now()));
      } catch {
        /* 무시 */
      }
      sessionStorage.removeItem(draftKey);
      onPosted(q);
    } catch (e2) {
      const code = (e2 as { code?: string }).code;
      setError(code === 'unavailable' ? 'errors.network' : 'errors.cantPost');
      setBusy(false);
    }
  }

  const length = text.trim().length;
  return (
    <Sheet title={t('store.askTitle')} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        <div className="kind-chips" role="radiogroup" aria-label={t('store.label')}>
          {QUESTION_KINDS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => pickKind(k)}>
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
          className="textarea"
          rows={5}
          maxLength={LIMITS.questionMax + 50}
          placeholder={t(`kindPlaceholder.${kind}`)}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={!!error}
          aria-describedby="q-hint q-err"
          style={{ resize: 'none', background: 'var(--raised)', border: 0, borderRadius: 14 }}
        />
        {error && (
          <p className="field__error" id="q-err" role="alert" style={{ marginTop: 8 }}>
            {t(error)}
          </p>
        )}
        <p className="num" style={{ fontSize: 12, color: length > LIMITS.questionMax ? 'var(--negative)' : 'var(--muted)', textAlign: 'right', marginTop: 6 }}>
          {length} / {LIMITS.questionMax}
        </p>

        <div className="switch-row" style={{ paddingTop: 4 }}>
          <div className="switch-row__text">
            <p className="switch-row__title">{t('store.privateTitle')}</p>
            <p className="switch-row__desc">{t('store.privateDesc')}</p>
          </div>
          <Switch
            checked={ownerOnly}
            onChange={(v) => {
              setOwnerOnly(v);
              setTouchedPrivate(true);
            }}
            label={t('store.privateTitle')}
          />
        </div>

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

        <button className="btn btn--primary btn--block" style={{ marginTop: 16 }} disabled={busy || wait > 0 || length === 0}>
          {busy ? t('store.sending') : wait > 0 ? t('store.wait', { s: wait }) : t('store.send')}
        </button>
        <p className="field__hint" id="q-hint" style={{ marginTop: 12 }}>
          <Trans i18nKey="store.consent" components={{ 1: <Link to="/policy" /> }} />
        </p>
      </form>
    </Sheet>
  );
}
