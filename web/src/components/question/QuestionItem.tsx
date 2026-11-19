import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { relativeTime } from '../../lib/format';
import type { Question, Store } from '../../lib/types';
import { MoreIcon } from '../ui/Icons';
import { StoreIcon } from '../ui/StoreIcon';

export type StoreLook = Pick<Store, 'storeName' | 'category' | 'tone'>;

interface Props {
  q: Question;
  store: StoreLook;
  mine?: boolean;
  owner?: boolean;
  fresh?: boolean;
  selected?: boolean;
  onMenu?: () => void;
  leading?: ReactNode;
  actions?: ReactNode;
}

const isLong = (s: string) => s.length > 180 || s.split('\n').length > 5;

/** 가게의 글 한 개: 인용된 익명 질문 + 그 아래 펼쳐진 답변 */
export function QuestionItem({ q, store, mine, owner, fresh, selected, onMenu, leading, actions }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const long = !!q.answer && isLong(q.answer.body);
  const cls = ['qitem', fresh && 'rise', q.hidden && 'qitem--hidden', selected && 'qitem--selected'].filter(Boolean).join(' ');
  const when = q.answer?.at ?? q.createdAt;

  return (
    <article className={cls}>
      <div className="qitem__side">{leading ?? <StoreIcon category={store.category} tone={store.tone} size={40} />}</div>
      <div className="qitem__main">
        <div className="qitem__head">
          <span className="who">{store.storeName}</span>
          <time dateTime={when?.toISOString()}>· {relativeTime(when)}</time>
          {mine && <span className="pill pill--mine">{t('store.mine')}</span>}
          {owner && q.hidden && (
            <span className={`pill ${q.hiddenBy === 'owner' ? 'pill--hidden' : 'pill--danger'}`}>{t(`inbox.hiddenBy.${q.hiddenBy ?? 'owner'}`)}</span>
          )}
          <span className="spacer" />
          {onMenu && (
            <button className="icon-btn" onClick={onMenu} aria-label={t('common.menu')} style={{ margin: '-8px -10px -8px 0' }}>
              <MoreIcon />
            </button>
          )}
        </div>

        <div className="qitem__bubble">
          <p className="qitem__bubble-label">
            <span className="qitem__anon" aria-hidden="true" />
            {t('store.anonymousQ')}
            {q.answer && <span className="qitem__bubble-time">{relativeTime(q.createdAt)}</span>}
          </p>
          <p className="qitem__bubble-text">{q.body}</p>
        </div>

        {q.answer ? (
          <>
            <p className={`qitem__answer${long && !expanded ? ' qitem__answer--clamp' : ''}`}>{q.answer.body}</p>
            {long && (
              <button className="qitem__more" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
                {expanded ? t('store.less') : t('store.moreText')}
              </button>
            )}
            {q.answer.editedAt && <p className="qitem__edited">{t('store.edited')}</p>}
          </>
        ) : (
          !owner && <p className="qitem__waiting">{t('store.waiting')}</p>
        )}
        {actions && <div className="qitem__actions">{actions}</div>}
      </div>
    </article>
  );
}
