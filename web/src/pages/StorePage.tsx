import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { QuestionItem } from '../components/question/QuestionItem';
import { StoreHeader, useScrolledPast } from '../components/question/StoreHeader';
import { ReportSheet } from '../components/question/ReportSheet';
import { Footer, PublicTopbar } from '../components/ui/Layout';
import { Sheet, useToast } from '../components/ui/Overlay';
import { ShareIcon } from '../components/ui/Icons';
import { ErrorBox, Loading, TicketSkeleton } from '../components/ui/States';
import i18n, { currentLang } from '../i18n';
import { CategoryGlyph } from '../components/ui/StoreIcon';
import {
  alreadyReported,
  fetchAnsweredCount,
  fetchPublicPage,
  toggleHelpful,
  votedIds,
  type PublicSort,
  myQuestionIds,
  reportQuestion,
  reportStore,
  type Page,
} from '../lib/questions';
import { CODE_RE, storeUrl } from '../lib/storeCode';
import { getStore } from '../lib/stores';
import type { Question, Store } from '../lib/types';


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

  // 목록도 동시에 요청 (가게 정보를 기다렸다가 요청하면 한 번 더 왕복)
  const qc = useQueryClient();
  useEffect(() => {
    if (!valid) return;
    qc.prefetchInfiniteQuery({
      queryKey: ['public', code, 'latest'],
      queryFn: ({ pageParam }) => fetchPublicPage(code, 'latest', pageParam as Page['cursor']),
      initialPageParam: null as Page['cursor'],
      staleTime: 60_000,
    });
  }, [qc, code, valid]);

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
      <main className="page page--fill">
        <div className="center-state center-state--big">
          <span className="state-icon" aria-hidden="true">
            <CategoryGlyph category="other" size={32} />
          </span>
          <h1>{title}</h1>
          <p>{desc}</p>
          <Link to="/" className="btn btn--line" style={{ marginTop: 8 }}>
            {i18n.t('notFound.home')}
          </Link>
        </div>
        <Footer />
      </main>
    </>
  );
}

function ActiveStore({ store }: { store: Store }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [sort, setSort] = useState<PublicSort>('latest');
  const listKey = ['public', store.code, sort];
  const [mine] = useState(() => myQuestionIds(store.code));
  const [voted, setVoted] = useState(() => votedIds());
  const [menuFor, setMenuFor] = useState<Question | null>(null);
  const [reporting, setReporting] = useState<Question | 'store' | null>(null);

  useEffect(() => {
    document.title = `${store.storeName} · ${t('app.name')}`;
    document.body.classList.add('white');
    return () => document.body.classList.remove('white');
  }, [store.storeName, t]);

  const [headerRef, past] = useScrolledPast<HTMLElement>();
  const answered = useQuery({ queryKey: ['answered', store.code], queryFn: () => fetchAnsweredCount(store.code), staleTime: 10 * 60_000 });

  // 사장님이 답변한 공개 글만, 10개씩, 60초 캐시, 실시간 구독 없음 (읽기 절감)
  const list = useInfiniteQuery({
    queryKey: listKey,
    queryFn: ({ pageParam }) => fetchPublicPage(store.code, sort, pageParam),
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

  /** 두 탭의 캐시를 같이 고친다 (다시 읽지 않음) */
  const patchAll = (fn: (q: Question) => Question | null) => {
    for (const s of ['latest', 'helpful'] as PublicSort[]) {
      qc.setQueryData<InfiniteData<Page>>(['public', store.code, s], (old) =>
        old ? { ...old, pages: old.pages.map((p) => ({ ...p, items: p.items.flatMap((i) => { const r = fn(i); return r ? [r] : []; }) })) } : old,
      );
    }
  };

  async function onVote(q: Question) {
    const on = !voted.has(q.id);
    const apply = (state: boolean, delta: number) => {
      setVoted((v) => {
        const n = new Set(v);
        if (state) n.add(q.id);
        else n.delete(q.id);
        return n;
      });
      patchAll((i) => (i.id === q.id ? { ...i, helpful: Math.max(0, i.helpful + delta) } : i));
    };
    apply(on, on ? 1 : -1); // 바로 반영하고
    try {
      const real = await toggleHelpful(store.code, q.id, on);
      if (real !== on) apply(real, real ? 1 : -1);
    } catch {
      apply(!on, on ? -1 : 1); // 실패하면 되돌림
      toast(t('errors.generic'));
    }
  }

  function onShare(q: Question) {
    const message = `${t('store.shareText', { name: store.storeName, q: q.body, lng: currentLang() })}\n${url}`;
    if (typeof navigator.share === 'function') navigator.share({ text: message }).catch(() => undefined);
    else navigator.clipboard.writeText(message).then(() => toast(t('common.copied')));
  }

  /** 쓰기 페이지로: 지금 스크롤 위치를 기억해 두고 돌아오면 복원 */
  const scrollKey = `sayandgo:scroll:${store.code}`;
  function openCompose() {
    sessionStorage.setItem(scrollKey, String(window.scrollY));
    navigate(`/q/${store.code}/write`, { state: { fromStore: true } });
  }
  useLayoutEffect(() => {
    const y = sessionStorage.getItem(scrollKey);
    if (y == null || !list.data) return;
    sessionStorage.removeItem(scrollKey);
    window.scrollTo(0, Number(y)); // 목록은 캐시에서 바로 그려져 다시 읽지 않는다
  }, [scrollKey, list.data]);

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
  const shareStore = () =>
    typeof navigator.share === 'function'
      ? navigator.share({ text: `${t('share.shareText', { name: store.storeName, lng: currentLang() })}\n${url}` }).catch(() => undefined)
      : navigator.clipboard.writeText(url).then(() => toast(t('common.copied')));

  return (
    <>
      <PublicTopbar
        title={store.storeName}
        showTitle={past}
        end={
          <button className="icon-btn" onClick={shareStore} aria-label={t('common.share')} style={{ marginRight: -8 }}>
            <ShareIcon size={20} />
          </button>
        }
      />
      <main className="page page--grow" style={{ paddingBottom: items.length ? 'calc(110px + env(safe-area-inset-bottom))' : 'env(safe-area-inset-bottom)' }}>
        <StoreHeader
          headerRef={headerRef}
          store={store}
          intro={store.intro}
          answered={answered.data ?? null}
          invite={store.acceptingQuestions ? t('store.invite') : undefined}
          extra={!store.acceptingQuestions && <span className="chip chip--paused" style={{ marginLeft: 8 }}>{t('store.pausedChip')}</span>}
          actions={
            store.acceptingQuestions && (
              <button className="btn btn--black" onClick={openCompose}>
                {t('store.ask')}
              </button>
            )
          }
        />

        <div className="utabs" role="tablist">
          {(['latest', 'helpful'] as PublicSort[]).map((k) => (
            <button key={k} role="tab" aria-selected={sort === k} onClick={() => setSort(k)}>
              {k === 'latest' ? t('store.sortLatest') : t('store.sortHelpful')}
            </button>
          ))}
        </div>

        <section className="posts grow" aria-label={t('store.listTitle')}>
          {list.isLoading && (
            <>
              <TicketSkeleton />
              <TicketSkeleton />
              <TicketSkeleton />
            </>
          )}
          {list.isError && (
            <div style={{ padding: 20 }}>
              <ErrorBox onRetry={() => list.refetch()} />
            </div>
          )}
          {list.isSuccess && items.length === 0 && (
            <div className="center-state" style={{ padding: '96px 20px' }}>
              <h2 style={{ fontSize: 16 }}>{t('store.emptyTitle')}</h2>
              <p>{t('store.emptyDesc')}</p>
            </div>
          )}
          {items.map((q) => (
            <QuestionItem
              key={q.id}
              q={q}
              store={store}
              mine={mine.has(q.id)}
              voted={voted.has(q.id)}
              onVote={() => onVote(q)}
              onShare={() => onShare(q)}
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

      {store.acceptingQuestions && (
        <div className={`ask-bar${past ? ' ask-bar--show' : ''}`} aria-hidden={!past}>
          <button className="btn btn--black" tabIndex={past ? 0 : -1} onClick={openCompose}>
            {t('store.ask')}
          </button>
        </div>
      )}

      {menuFor && (
        <Sheet onClose={() => setMenuFor(null)}>
          <div className="menu-list">
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

      {reporting && <ReportSheet onClose={() => setReporting(null)} onSubmit={onReport} />}
    </>
  );
}
