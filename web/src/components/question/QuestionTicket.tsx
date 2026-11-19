import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { relativeTime } from '../../lib/format';
import type { Question } from '../../lib/types';
import { MoreIcon } from '../ui/Icons';

interface Props {
  q: Question;
  mine?: boolean;
  owner?: boolean;
  fresh?: boolean;
  selected?: boolean;
  onMenu?: () => void;
  leading?: ReactNode;
  /** 답변 영역 대신 넣을 것 (사장님 답변 입력창) */
  answerSlot?: ReactNode;
  footer?: ReactNode;
}

/** 주문 전표 모양의 질문 카드. 답변은 홈 아래 민트 영역에 붙는다. */
export function QuestionTicket({ q, mine, owner, fresh, selected, onMenu, leading, answerSlot, footer }: Props) {
  const { t } = useTranslation();
  const cls = ['ticket', fresh && 'rise', q.hidden && 'ticket--hidden', selected && 'ticket--selected'].filter(Boolean).join(' ');
  return (
    <article className={cls}>
      <div className="ticket__q">
        <div className="ticket__meta">
          {leading}
          <time dateTime={q.createdAt?.toISOString()}>{relativeTime(q.createdAt)}</time>
          {q.status === 'open' && <span className="pill pill--open">{t('store.open')}</span>}
          {mine && <span className="pill pill--mine">{t('store.mine')}</span>}
          {owner && q.pinned && <span className="pill pill--answered">{t('inbox.pinned')}</span>}
          {owner && q.hidden && (
            <span className={`pill ${q.hiddenBy === 'owner' ? 'pill--hidden' : 'pill--danger'}`}>
              {t(`inbox.hiddenBy.${q.hiddenBy ?? 'owner'}`)}
            </span>
          )}
          <span className="spacer" />
          {onMenu && (
            <button className="icon-btn" onClick={onMenu} aria-label={t('common.menu')} style={{ margin: '-10px -8px -10px 0' }}>
              <MoreIcon />
            </button>
          )}
        </div>
        <p className="ticket__body">{q.body}</p>
      </div>
      {answerSlot ??
        (q.answer && (
          <div className="ticket__a">
            <p className="ticket__a-label">{t('store.answer')}</p>
            <p className="ticket__a-body">{q.answer.body}</p>
            <p className="ticket__a-meta">
              {relativeTime(q.answer.at)}
              {q.answer.editedAt && ` · ${t('store.edited')}`}
            </p>
          </div>
        ))}
      {footer}
    </article>
  );
}
