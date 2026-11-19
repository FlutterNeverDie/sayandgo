import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Avatar, QuestionItem } from '../components/question/QuestionItem';
import { ReportSheet } from '../components/question/ReportSheet';
import { Footer, PublicTopbar } from '../components/ui/Layout';
import { Sheet, useToast } from '../components/ui/Overlay';
import { ErrorBox, Loading, TicketSkeleton } from '../components/ui/States';
import { currentLang } from '../i18n';
import {
  alreadyReported,
  deleteMyQuestion,
  fetchCounts,
  fetchPublicPage,
  myQuestionIds,
  postQuestion,
  reportQuestion,
  reportStore,
  type Page,
} from '../lib/questions';
import { CODE_RE, storeUrl } from '../lib/storeCode';
import { getStore } from '../lib/stores';
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

type Tab = 'all' | 'answered';

function ActiveStore({ store }: { store: Store }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(store.showUnanswered ? 'all' : 'answered');
  const answeredOnly = tab === 'answered';
  const listKey = ['public', store.code, answeredOnly];
  const [mine, setMine] = useState(() => myQuestionIds(store.code));
  const [freshId, setFreshId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [menuFor, setMenuFor] = useState<Question | null>(null);
  const [reporting, setReporting] = useState<Question | 'store' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Question | null>(null);

  useEffect(() => {
    document.title = `${store.storeName} · ${t('app.name')}`;
  }, [store.storeName, t]);

  const counts = useQuery({ queryKey: ['counts', store.code], queryFn: () => fetchCounts(store.code), staleTime: 10 * 60_000 });

  // 10개씩, 60초 캐시, 실시간 구독 없음 (읽기 절감)
  const list = useInfiniteQuery({
    queryKey: listKey,
    queryFn: ({ pageParam }) => fetchPublicPage(store.code, answeredOnly, pageParam),
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

  const setItems = (fn: (pages: Page[]) => Page[]) =>
    qc.setQueryData<InfiniteData<Page>>(['public', store.code, false], (old) => (old ? { ...old, pages: fn(old.pages) } : old));

  function onPosted(q: Question) {
    setComposing(false);
    setMine(myQuestionIds(store.code));
    qc.setQueryData<{ total: number; answered: number }>(['counts', store.code], (c) => (c ? { ...c, total: c.total + 1 } : c));
    if (!store.showUnanswered) {
      toast(t('store.sentHidden'));
      return;
    }
    // 다시 불러오지 않고 맨 위에 끼워 넣는다 (읽기 0)
    setItems((pages) => [{ ...pages[0], items: [q, ...(pages[0]?.items ?? [])] }, ...pages.slice(1)]);
    setTab('all');
    setFreshId(q.id);
    toast(t('store.sent'));
  }

  async function onDeleteMine(q: Question) {
    setConfirmDelete(null);
    try {
      await deleteMyQuestion(store.code, q.id);
      for (const only of [false, true]) {
        qc.setQueryData<InfiniteData<Page>>(['public', store.code, only], (old) =>
          old ? { ...old, pages: old.pages.map((p) => ({ ...p, items: p.items.filter((i) => i.id !== q.id) })) } : old,
        );
      }
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
      <PublicTopbar />
      <main className="page">
        <header className="profile">
          <h1 className="profile__name">{store.storeName}</h1>
          <Avatar name={store.storeName} />
          {store.intro && <p className="profile__intro">{store.intro}</p>}
          <p className="profile__stats num">
            {counts.data ? (
              <>
                {t('store.statsQ')} <b>{counts.data.total}</b> · {t('store.statsA')} <b>{counts.data.answered}</b>
              </>
            ) : (
              ' '
            )}
          </p>
          <div className="profile__actions">
            {store.acceptingQuestions ? (
              <button className="btn btn--primary" onClick={() => setComposing(true)}>
                {t('store.ask')}
              </button>
            ) : (
              <p className="notice" style={{ flex: 1 }}>
                {t('store.paused')}
              </p>
            )}
            {'share' in navigator && (
              <button className="btn" onClick={() => navigator.share({ title: store.storeName, url }).catch(() => undefined)}>
                {t('store.shareStore')}
              </button>
            )}
          </div>
        </header>

        {store.showUnanswered && (
          <div className="uline-tabs" role="tablist">
            {(['all', 'answered'] as Tab[]).map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                {k === 'all' ? t('store.tabAll') : t('store.tabAnswered')}
              </button>
            ))}
          </div>
        )}

        <section className="feed" aria-label={t('store.listTitle')}>
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
            <div className="center-state" style={{ padding: '48px 16px' }}>
              <h2 style={{ fontSize: 16 }}>{t('store.emptyTitle')}</h2>
              <p>{answeredOnly ? t('store.emptyAnsweredDesc') : t('store.emptyDesc')}</p>
            </div>
          )}
          {items.map((q, i) => (
            <QuestionItem
              key={q.id}
              q={q}
              storeName={store.storeName}
              mine={mine.has(q.id)}
              fresh={q.id === freshId}
              defaultOpen={i === 0}
              onMenu={() => setMenuFor(q)}
            />
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

/** 질문하기: 버튼을 눌렀을 때만 열리는 시트 (손님이 직접 연 것이라 바로 입력창에 포커스) */
function ComposeSheet({ store, onClose, onPosted }: { store: Store; onClose: () => void; onPosted: (q: Question) => void }) {
  const { t } = useTranslation();
  const draftKey = `qplace:draft:${store.code}`;
  const [text, setText] = useState(() => sessionStorage.getItem(draftKey) ?? '');
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
    <Sheet title={t('store.askTitle')} desc={t('store.anonymous')} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="q-body" className="sr-only">
          {t('store.label')}
        </label>
        <textarea
          id="q-body"
          ref={ref}
          className="textarea"
          rows={5}
          maxLength={LIMITS.questionMax + 50}
          placeholder={t('store.placeholder')}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <span className="num" style={{ fontSize: 12, color: length > LIMITS.questionMax ? 'var(--negative)' : 'var(--muted)' }}>
            {length} / {LIMITS.questionMax}
          </span>
          <button className="btn btn--primary" style={{ marginLeft: 'auto', minWidth: 120 }} disabled={busy || wait > 0 || length === 0}>
            {busy ? t('store.sending') : wait > 0 ? t('store.wait', { s: wait }) : t('store.send')}
          </button>
        </div>
        <p className="field__hint" id="q-hint" style={{ marginTop: 12 }}>
          <Trans i18nKey="store.consent" components={{ 1: <Link to="/policy" /> }} />
        </p>
      </form>
    </Sheet>
  );
}
