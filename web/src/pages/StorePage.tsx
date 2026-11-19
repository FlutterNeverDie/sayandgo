import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { QuestionTicket } from '../components/question/QuestionTicket';
import { ReportSheet } from '../components/question/ReportSheet';
import { Footer, PublicTopbar } from '../components/ui/Layout';
import { Sheet, useToast } from '../components/ui/Overlay';
import { ErrorBox, Loading, TicketSkeleton } from '../components/ui/States';
import { currentLang } from '../i18n';
import {
  alreadyReported,
  deleteMyQuestion,
  fetchPublicPage,
  myQuestionIds,
  postQuestion,
  reportQuestion,
  reportStore,
  type Page,
} from '../lib/questions';
import { getStore } from '../lib/stores';
import { CODE_RE } from '../lib/storeCode';
import type { Question, Store } from '../lib/types';
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
  const answeredOnly = !store.showUnanswered;
  const listKey = ['public', store.code, answeredOnly];
  const [mine, setMine] = useState(() => myQuestionIds(store.code));
  const [freshId, setFreshId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<Question | null>(null);
  const [reporting, setReporting] = useState<Question | 'store' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Question | null>(null);

  useEffect(() => {
    document.title = `${store.storeName} · ${t('app.name')}`;
  }, [store.storeName, t]);

  // 10개씩, 60초 캐시, 실시간 구독 없음 (읽기 절감)
  const list = useInfiniteQuery({
    queryKey: listKey,
    queryFn: ({ pageParam }) => fetchPublicPage(store.code, answeredOnly, pageParam),
    initialPageParam: null as Page['cursor'],
    getNextPageParam: (last) => last.cursor ?? undefined,
    staleTime: 60_000,
  });
  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);

  const setItems = (fn: (pages: Page[]) => Page[]) =>
    qc.setQueryData<InfiniteData<Page>>(listKey, (old) => (old ? { ...old, pages: fn(old.pages) } : old));

  function onPosted(q: Question) {
    setMine(myQuestionIds(store.code));
    if (answeredOnly) {
      toast(t('store.sentHidden'));
      return;
    }
    // 다시 불러오지 않고 맨 위에 끼워 넣는다 (읽기 0)
    setItems((pages) => [{ ...pages[0], items: [q, ...(pages[0]?.items ?? [])] }, ...pages.slice(1)]);
    setFreshId(q.id);
    toast(t('store.sent'));
  }

  async function onDeleteMine(q: Question) {
    setConfirmDelete(null);
    try {
      await deleteMyQuestion(store.code, q.id);
      setItems((pages) => pages.map((p) => ({ ...p, items: p.items.filter((i) => i.id !== q.id) })));
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

  return (
    <>
      <PublicTopbar />
      <main className="page">
        <header style={{ padding: '28px 0 20px' }}>
          <h1 className="title">{store.storeName}</h1>
          {store.intro && <p style={{ marginTop: 6, color: 'var(--muted)' }}>{store.intro}</p>}
        </header>

        {store.acceptingQuestions ? (
          <Composer store={store} onPosted={onPosted} />
        ) : (
          <p className="notice">{t('store.paused')}</p>
        )}

        <section className="section" aria-labelledby="list-title">
          <h2 id="list-title" className="section__title">
            {t('store.listTitle')}
          </h2>
          {list.isLoading && (
            <>
              <TicketSkeleton />
              <TicketSkeleton />
              <TicketSkeleton />
            </>
          )}
          {list.isError && <ErrorBox onRetry={() => list.refetch()} />}
          {list.isSuccess && items.length === 0 && (
            <div className="empty">
              <strong>{t('store.emptyTitle')}</strong>
              {answeredOnly ? t('store.emptyAnsweredDesc') : t('store.emptyDesc')}
            </div>
          )}
          {items.map((q) => (
            <QuestionTicket key={q.id} q={q} mine={mine.has(q.id)} fresh={q.id === freshId} onMenu={() => setMenuFor(q)} />
          ))}
          {list.hasNextPage && (
            <button className="btn btn--block" style={{ marginTop: 16 }} onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
              {list.isFetchingNextPage ? t('common.loading') : t('common.more')}
            </button>
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

function Composer({ store, onPosted }: { store: Store; onPosted: (q: Question) => void }) {
  const { t } = useTranslation();
  const draftKey = `qplace:draft:${store.code}`;
  const [text, setText] = useState(() => sessionStorage.getItem(draftKey) ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const wait = Math.max(0, WAIT_SEC - Math.floor((now - readLastPost()) / 1000));

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [wait]);

  useEffect(() => {
    sessionStorage.setItem(draftKey, text);
  }, [draftKey, text]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = tidyText(text);
    const err = checkQuestion(body, store.blockedWords);
    setError(err);
    if (err || wait > 0) return;
    setBusy(true);
    try {
      const q = await postQuestion(store.code, body, currentLang());
      try {
        localStorage.setItem(LAST_POST_KEY, String(Date.now()));
      } catch {
        /* 무시 */
      }
      setNow(Date.now());
      setText('');
      onPosted(q);
    } catch (e2) {
      const code = (e2 as { code?: string }).code;
      setError(code === 'unavailable' ? 'errors.network' : 'errors.cantPost');
    } finally {
      setBusy(false);
    }
  }

  const length = text.trim().length;
  return (
    <form onSubmit={onSubmit} noValidate className="panel" style={{ padding: 12 }}>
      <label htmlFor="q-body" className="sr-only">
        {t('store.label')}
      </label>
      <textarea
        id="q-body"
        className="textarea"
        rows={3}
        maxLength={LIMITS.questionMax + 50}
        placeholder={t('store.placeholder')}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(null);
        }}
        aria-invalid={!!error}
        aria-describedby="q-hint q-err"
        style={{ border: 0, padding: 4, minHeight: 84, resize: 'none' }}
      />
      {error && (
        <p className="field__error" id="q-err" role="alert" style={{ padding: '0 4px 8px' }}>
          {t(error)}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="num" style={{ fontSize: 12, color: length > LIMITS.questionMax ? 'var(--negative)' : 'var(--muted)', paddingLeft: 4 }}>
          {length} / {LIMITS.questionMax}
        </span>
        <button className="btn btn--primary" style={{ marginLeft: 'auto', minWidth: 96 }} disabled={busy || wait > 0 || length === 0}>
          {busy ? t('store.sending') : wait > 0 ? t('store.wait', { s: wait }) : t('store.send')}
        </button>
      </div>
      <p className="field__hint" id="q-hint" style={{ padding: '10px 4px 0' }}>
        {t('store.anonymous')}{' '}
        <Trans i18nKey="store.consent" components={{ 1: <Link to="/policy" /> }} />
      </p>
    </form>
  );
}
