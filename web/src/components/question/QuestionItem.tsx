import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { relativeTime } from '../../lib/format';
import type { Question } from '../../lib/types';
import { ChevronIcon, MoreIcon } from '../ui/Icons';

interface Props {
  q: Question;
  storeName: string;
  mine?: boolean;
  owner?: boolean;
  fresh?: boolean;
  selected?: boolean;
  defaultOpen?: boolean;
  onMenu?: () => void;
  leading?: ReactNode;
  actions?: ReactNode;
}

export function Avatar({ name, small }: { name: string; small?: boolean }) {
  return (
    <span className={small ? 'avatar avatar--sm' : 'avatar'} aria-hidden="true">
      {Array.from(name.trim())[0] ?? 'Q'}
    </span>
  );
}

/** 피드 한 줄: 익명 질문 말풍선 + 한 카드 안에서 펼쳐지는 사장님 답변 */
export function QuestionItem({ q, storeName, mine, owner, fresh, selected, defaultOpen, onMenu, leading, actions }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(!!defaultOpen);
  const cls = ['qitem', fresh && 'rise', q.hidden && 'qitem--hidden', selected && 'qitem--selected'].filter(Boolean).join(' ');
  const answerId = `ans-${q.id}`;

  return (
    <article className={cls}>
      <div className="qitem__head">
        {leading}
        <span className="who">{t('store.anonymousQ')}</span>
        <time dateTime={q.createdAt?.toISOString()}>{relativeTime(q.createdAt)}</time>
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
      <p className="qitem__bubble">{q.body}</p>

      {q.answer ? (
        <button className="qitem__answer" aria-expanded={open} aria-controls={answerId} onClick={() => setOpen((o) => !o)}>
          <Avatar name={storeName} small />
          <span className="qitem__answer-who">
            <b>{t('store.answer')}</b>
            {relativeTime(q.answer.at)}
            {q.answer.editedAt && ` · ${t('store.edited')}`}
          </span>
          <span className="qitem__chev">
            <ChevronIcon />
          </span>
          <span className="qitem__answer-text" id={answerId}>
            {q.answer.body}
          </span>
        </button>
      ) : (
        <p className="qitem__waiting">{t('store.waiting')}</p>
      )}
      {actions && <div className="qitem__actions">{actions}</div>}
    </article>
  );
}
