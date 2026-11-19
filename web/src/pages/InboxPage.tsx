import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { RequireOwner } from '../app/auth';
import { Avatar, QuestionItem } from '../components/question/QuestionItem';
import { OwnerShell } from '../components/ui/Layout';
import { Sheet, useToast } from '../components/ui/Overlay';
import { ErrorBox, TicketSkeleton } from '../components/ui/States';
import {
  blockAuthor,
  deleteQuestions,
  fetchInboxPage,
  fetchOwnerCounts,
  removeAnswer,
  saveAnswer,
  setHidden,
  subscribeInbox,
  type InboxTab,
  type Page,
} from '../lib/questions';
import { updateStore } from '../lib/stores';
import type { Question, Store } from '../lib/types';
import { checkAnswer, LIMITS, tidyText } from '../lib/validation';

const TABS: InboxTab[] = ['answered', 'open', 'hidden'];
const UNDO_MS = 5000;

export function InboxPage() {
  return <RequireOwner>{(store) => <Inbox store={store} />}</RequireOwner>;
}

function usePageVisible() {
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const on = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}

/** 첫 10개는 실시간, 그 뒤는 "더 보기"로 한 번씩. 화면이 꺼지면 구독 해제. */
function useInboxList(code: string, tab: InboxTab) {
  const visible = usePageVisible();
  const [head, setHead] = useState<Page | null>(null);
  const [more, setMore] = useState<Question[]>([]);
  const [moreCursor, setMoreCursor] = useState<Page['cursor']>(null);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setHead(null);
    setMore([]);
    setMoreCursor(null);
  }, [code, tab]);

  useEffect(() => {
    if (!visible) return;
    return subscribeInbox(
      code,
      tab,
      (p) => {
        setHead(p);
        setError(false);
      },
      () => setError(true),
    );
  }, [code, tab, visible, retry]);

  const cursor = more.length ? moreCursor : head?.cursor ?? null;
  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const p = await fetchInboxPage(code, tab, cursor);
      setMore((m) => [...m, ...p.items]);
      setMoreCursor(p.cursor);
    } finally {
      setLoadingMore(false);
    }
  }, [code, tab, cursor]);

  const items = useMemo(() => {
    const seen = new Set<string>();
    return [...(head?.items ?? []), ...more].filter((q) => (seen.has(q.id) ? false : (seen.add(q.id), true)));
  }, [head, more]);

  /** "더 보기"로 불러온 항목은 실시간이 아니라서 직접 고친다 */
  const patchMore = useCallback(
    (id: string, fn: (q: Question) => Question | null) => setMore((m) => m.flatMap((q) => (q.id === id ? (fn(q) ? [fn(q)!] : []) : [q]))),
    [],
  );

  return {
    items,
    loading: !head && !error,
    error,
    hasMore: !!cursor,
    loadMore,
    loadingMore,
    patchMore,
    retry: () => setRetry((n) => n + 1),
  };
}

function Inbox({ store }: { store: Store }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const counts = useQuery({
    queryKey: ['ownerCounts', store.code],
    queryFn: () => fetchOwnerCounts(store.code),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const [tab, setTab] = useState<InboxTab | null>(null);
  // 처음엔 답할 질문이 있으면 "질문" 탭, 없으면 "답변" 탭
  const activeTab: InboxTab = tab ?? (counts.data ? (counts.data.open > 0 ? 'open' : 'answered') : 'open');
  const list = useInboxList(store.code, activeTab);
  const refreshCounts = () => qc.invalidateQueries({ queryKey: ['ownerCounts', store.code] });

  const [menuFor, setMenuFor] = useState<Question | null>(null);
  const [blockFor, setBlockFor] = useState<Question | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 5초 되돌리기 삭제
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const [, force] = useState(0);
  const timers = useRef<Map<number, { ids: string[]; timer: ReturnType<typeof setTimeout> }>>(new Map());
  const { patchMore } = list;

  const commitDelete = useCallback(
    (key: number) => {
      const entry = timers.current.get(key);
      if (!entry) return;
      clearTimeout(entry.timer);
      timers.current.delete(key);
      deleteQuestions(store.code, entry.ids)
        .then(() => {
          entry.ids.forEach((id) => patchMore(id, () => null));
          qc.invalidateQueries({ queryKey: ['ownerCounts', store.code] });
        })
        .catch(() => toast(t('errors.generic')))
        .finally(() => {
          entry.ids.forEach((id) => pendingIdsRef.current.delete(id));
          force((n) => n + 1);
        });
    },
    [store.code, patchMore, qc, toast, t],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      // 화면을 떠나면 기다리던 삭제를 바로 실행
      for (const [key, entry] of map) {
        clearTimeout(entry.timer);
        deleteQuestions(store.code, entry.ids).catch(() => undefined);
        map.delete(key);
      }
    };
  }, [store.code]);

  function scheduleDelete(ids: string[]) {
    const key = Date.now() + Math.random();
    ids.forEach((id) => pendingIdsRef.current.add(id));
    force((n) => n + 1);
    timers.current.set(key, { ids, timer: setTimeout(() => commitDelete(key), UNDO_MS) });
    toast(ids.length > 1 ? t('inbox.deletedN', { n: ids.length }) : t('inbox.deleted'), {
      ms: UNDO_MS,
      action: {
        label: t('inbox.undo'),
        onClick: () => {
          const entry = timers.current.get(key);
          if (entry) clearTimeout(entry.timer);
          timers.current.delete(key);
          ids.forEach((id) => pendingIdsRef.current.delete(id));
          force((n) => n + 1);
        },
      },
    });
  }

  const openCount = counts.data?.open ?? 0;
  useEffect(() => {
    document.title = openCount ? `(${openCount}) ${t('app.name')}` : t('app.name');
    return () => {
      document.title = t('app.name');
    };
  }, [openCount, t]);

  const visibleItems = list.items.filter((q) => !pendingIdsRef.current.has(q.id));
  const editingQ = editing ? list.items.find((q) => q.id === editing) ?? null : null;
  const selectedIds = [...selected].filter((id) => visibleItems.some((q) => q.id === id));

  async function run(action: () => Promise<unknown>, okText?: string) {
    try {
      await action();
      if (okText) toast(okText);
      refreshCounts();
    } catch {
      toast(t('errors.generic'));
    }
  }

  async function toggleHidden(q: Question) {
    const next = !q.hidden;
    await run(() => setHidden(store.code, [q.id], next), next ? t('inbox.hidden') : undefined);
    patchMore(q.id, () => null); // 탭 조건에서 빠지므로 목록에서 뺀다
  }

  async function doBlock(q: Question, alsoDelete: boolean) {
    setBlockFor(null);
    try {
      await blockAuthor(store.code, q);
      toast(t('inbox.blocked'));
      if (alsoDelete) scheduleDelete([q.id]);
    } catch {
      toast(t('inbox.blockFailed'));
    }
  }

  async function resume() {
    qc.setQueryData<Store>(['store', store.code], { ...store, acceptingQuestions: true });
    await run(() => updateStore(store.code, { acceptingQuestions: true }));
  }

  return (
    <OwnerShell storeName={store.storeName} openCount={openCount}>
      <main className="page">
        <header className="profile">
          <h1 className="profile__name">{store.storeName}</h1>
          <Avatar name={store.storeName} />
          {store.intro && <p className="profile__intro">{store.intro}</p>}
          <div className="profile__actions">
            <Link to="/settings" className="btn" style={{ flex: 1 }}>
              {t('store.editInfo')}
            </Link>
            <Link to="/share" className="btn btn--primary" style={{ flex: 1 }}>
              {t('store.qrShare')}
            </Link>
          </div>
        </header>

        {!store.acceptingQuestions && (
          <div className="notice" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ flex: 1 }}>{t('inbox.pausedNotice')}</span>
            <button className="btn btn--sm" onClick={resume}>
              {t('inbox.resume')}
            </button>
          </div>
        )}

        <div className="uline-tabs" role="tablist">
          {TABS.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={activeTab === k}
              onClick={() => {
                setTab(k);
                setSelected(new Set());
              }}
            >
              {t(`inbox.tabs.${k}`)}
              {counts.data && <span className="num"> {counts.data[k]}</span>}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 0' }}>
          <button
            className="btn btn--text btn--sm"
            onClick={() => {
              setSelecting((s) => !s);
              setSelected(new Set());
            }}
            aria-pressed={selecting}
          >
            {selecting ? t('common.cancel') : t('inbox.select')}
          </button>
        </div>

        <div className="feed" style={{ borderTop: '1px solid var(--rule)' }}>
          {list.loading && (
            <>
              <TicketSkeleton />
              <TicketSkeleton />
            </>
          )}
          {list.error && (
            <div style={{ padding: 16 }}>
              <ErrorBox onRetry={list.retry} />
            </div>
          )}
          {!list.loading && !list.error && visibleItems.length === 0 && (
            <div style={{ padding: 16 }}>
              <EmptyInbox tab={activeTab} store={store} />
            </div>
          )}

          {visibleItems.map((q) => (
            <QuestionItem
              key={q.id}
              q={q}
              storeName={store.storeName}
              owner
              selected={selected.has(q.id)}
              onMenu={selecting ? undefined : () => setMenuFor(q)}
              leading={
                selecting ? (
                  <input
                    type="checkbox"
                    className="qitem__select"
                    checked={selected.has(q.id)}
                    aria-label={t('inbox.select')}
                    onChange={(e) =>
                      setSelected((s) => {
                        const n = new Set(s);
                        if (e.target.checked) n.add(q.id);
                        else n.delete(q.id);
                        return n;
                      })
                    }
                  />
                ) : undefined
              }
              actions={
                !selecting && !q.answer ? (
                  <button className="btn btn--sm btn--primary" style={{ marginLeft: 10 }} onClick={() => setEditing(q.id)}>
                    {t('inbox.answer')}
                  </button>
                ) : undefined
              }
            />
          ))}
        </div>

        {list.hasMore && (
          <button className="btn btn--block" style={{ marginTop: 16 }} onClick={list.loadMore} disabled={list.loadingMore}>
            {list.loadingMore ? t('common.loading') : t('common.more')}
          </button>
        )}
      </main>

      {editingQ && (
        <AnswerSheet
          q={editingQ}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            await saveAnswer(store.code, editingQ, body);
            patchMore(editingQ.id, (x) => ({ ...x, status: 'answered', answer: { body, at: x.answer?.at ?? new Date(), editedAt: x.answer ? new Date() : null } }));
            setEditing(null);
            refreshCounts();
          }}
          onRemove={
            editingQ.answer
              ? async () => {
                  await removeAnswer(store.code, editingQ.id);
                  patchMore(editingQ.id, (x) => ({ ...x, status: 'open', answer: null }));
                  setEditing(null);
                  refreshCounts();
                }
              : undefined
          }
        />
      )}

      {selecting && selectedIds.length > 0 && (
        <div className="selection-bar" role="region" aria-label={t('inbox.selectedN', { n: selectedIds.length })}>
          <span style={{ fontSize: 14 }}>{t('inbox.selectedN', { n: selectedIds.length })}</span>
          {activeTab !== 'hidden' && (
            <button
              className="btn btn--sm"
              style={{ marginLeft: 'auto' }}
              onClick={async () => {
                const ids = selectedIds.filter((id) => visibleItems.find((q) => q.id === id)?.hiddenBy !== 'admin');
                await run(() => setHidden(store.code, ids, true), t('inbox.hidden'));
                ids.forEach((id) => patchMore(id, () => null));
                setSelected(new Set());
                setSelecting(false);
              }}
            >
              {t('inbox.hideN')}
            </button>
          )}
          <button
            className="btn btn--sm btn--danger"
            style={activeTab === 'hidden' ? { marginLeft: 'auto' } : undefined}
            onClick={() => {
              scheduleDelete(selectedIds);
              setSelected(new Set());
              setSelecting(false);
            }}
          >
            {t('inbox.deleteN')}
          </button>
        </div>
      )}

      {menuFor && (
        <Sheet onClose={() => setMenuFor(null)}>
          <div className="menu-list">
            <button
              onClick={() => {
                setEditing(menuFor.id);
                setMenuFor(null);
              }}
            >
              {menuFor.answer ? t('inbox.editAnswer') : t('inbox.answer')}
            </button>
            {menuFor.hiddenBy !== 'admin' && (
              <button
                onClick={() => {
                  toggleHidden(menuFor);
                  setMenuFor(null);
                }}
              >
                {menuFor.hidden ? t('inbox.unhide') : t('inbox.hide')}
              </button>
            )}
            <button
              onClick={() => {
                setBlockFor(menuFor);
                setMenuFor(null);
              }}
            >
              {t('inbox.block')}
            </button>
            <button
              className="danger"
              onClick={() => {
                scheduleDelete([menuFor.id]);
                setMenuFor(null);
              }}
            >
              {t('inbox.delete')}
            </button>
            <button onClick={() => setMenuFor(null)}>{t('common.cancel')}</button>
          </div>
        </Sheet>
      )}

      {blockFor && (
        <Sheet title={t('inbox.blockTitle')} desc={t('inbox.blockDesc')} onClose={() => setBlockFor(null)}>
          <div style={{ display: 'grid', gap: 8 }}>
            <button className="btn btn--ink btn--block" onClick={() => doBlock(blockFor, true)}>
              {t('inbox.blockAndDelete')}
            </button>
            <button className="btn btn--block" onClick={() => doBlock(blockFor, false)}>
              {t('inbox.blockOnly')}
            </button>
            <button className="btn btn--text btn--block" onClick={() => setBlockFor(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </Sheet>
      )}
    </OwnerShell>
  );
}

function EmptyInbox({ tab, store }: { tab: InboxTab; store: Store }) {
  const { t } = useTranslation();
  const isNew = !!store.createdAt && Date.now() - store.createdAt.getTime() < 3 * 86400_000;
  if (tab === 'open' && isNew) {
    return (
      <div className="empty" style={{ textAlign: 'left' }}>
        <strong>{t('inbox.firstRunTitle')}</strong>
        <p style={{ marginBottom: 12 }}>{t('inbox.firstRunDesc')}</p>
        <Link to="/share" className="btn btn--primary btn--sm">
          {t('inbox.getQr')}
        </Link>
      </div>
    );
  }
  return <div className="empty">{t(`inbox.empty.${tab}`)}</div>;
}

function AnswerSheet({ q, onSave, onClose, onRemove }: { q: Question; onSave: (body: string) => Promise<void>; onClose: () => void; onRemove?: () => Promise<void> }) {
  const { t } = useTranslation();
  const [text, setText] = useState(q.answer?.body ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch {
      setError('errors.generic');
      setBusy(false);
    }
  }

  return (
    <Sheet title={q.answer ? t('inbox.editAnswer') : t('inbox.answerTitle')} onClose={onClose}>
      <p className="qitem__quote">{q.body}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const body = tidyText(text);
          const err = checkAnswer(body);
          setError(err);
          if (!err) act(() => onSave(body));
        }}
      >
        <label className="sr-only" htmlFor={`a-${q.id}`}>
          {t('inbox.answerLabel')}
        </label>
        <textarea
          id={`a-${q.id}`}
          ref={ref}
          className="textarea"
          rows={5}
          maxLength={LIMITS.answer + 50}
          placeholder={t('inbox.answerPlaceholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={!!error}
          style={{ resize: 'none' }}
        />
        {error && (
          <p className="field__error" style={{ marginTop: 8 }}>
            {t(error)}
          </p>
        )}
        <div className="btn-row" style={{ marginTop: 12 }}>
          {onRemove && (
            <button type="button" className="btn btn--text btn--sm" onClick={() => act(onRemove)} disabled={busy}>
              {t('inbox.removeAnswer')}
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn btn--primary" disabled={busy || !text.trim()}>
            {t('inbox.saveAnswer')}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
