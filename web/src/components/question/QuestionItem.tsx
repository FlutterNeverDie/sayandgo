import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { relativeTime } from '../../lib/format';
import type { Question, Store } from '../../lib/types';
import { HeartIcon, MoreIcon, ShareIcon } from '../ui/Icons';
import { StoreIcon } from '../ui/StoreIcon';

export type StoreLook = Pick<Store, 'storeName' | 'category' | 'tone'>;

interface Props {
  q: Question;
  store: StoreLook;
  mine?: boolean;
  owner?: boolean;
  selected?: boolean;
  voted?: boolean;
  onVote?: () => void;
  onShare?: () => void;
  onMenu?: () => void;
  leading?: ReactNode;
  actions?: ReactNode;
}

const isLong = (s: string) => s.length > 180 || s.split('\n').length > 5;

/** 가게의 글: 가게 아바타 · 이름 · 시간 / 인용된 익명 질문 / 답변 / 도움됐어요 · 공유 */
export function QuestionItem({ q, store, mine, owner, selected, voted, onVote, onShare, onMenu, leading, actions }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const long = !!q.answer && isLong(q.answer.body);
  const when = q.answer?.at ?? q.createdAt;
  const cls = ['post', q.hidden && 'post--hidden', selected && 'post--selected'].filter(Boolean).join(' ');

  return (
    <article className={cls}>
      <div className="post__side">{leading ?? <StoreIcon category={store.category} tone={store.tone} size={40} round />}</div>
      <div className="post__main">
        <div className="post__head">
          <b>{store.storeName}</b>
          <time dateTime={when?.toISOString()}>· {relativeTime(when)}</time>
          {mine && <span className="pill pill--mine">{t('store.mine')}</span>}
          {owner && q.visibility === 'owner' && <span className="pill pill--hidden">{t('store.ownerOnly')}</span>}
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

        <div className="post__quote">
          <p className="post__qlabel">
            <span className={`post__dot post__dot--${q.kind}`} aria-hidden="true" />
            {t(`kindNoun.${q.kind}`)}
          </p>
          <p className="post__qtext">{q.body}</p>
        </div>

        {q.answer ? (
          <>
            <p className={`post__ans${long && !expanded ? ' post__ans--clamp' : ''}`}>{q.answer.body}</p>
            {long && (
              <button className="post__more" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
                {expanded ? t('store.less') : t('store.moreText')}
              </button>
            )}
          </>
        ) : (
          !owner && <p className="post__waiting">{t('store.waiting')}</p>
        )}

        {(onVote || onShare || (owner && q.answer)) && (
          <div className="post__acts">
            {onVote ? (
              <button className={`act${voted ? ' act--on' : ''}`} onClick={onVote} aria-pressed={voted}>
                <HeartIcon filled={voted} />
                {t('store.helpful')} {q.helpful > 0 && <span className="num">{q.helpful}</span>}
              </button>
            ) : (
              owner && q.answer && (
                <span className="act act--static">
                  <HeartIcon />
                  {t('store.helpful')} <span className="num">{q.helpful}</span>
                </span>
              )
            )}
            {onShare && (
              <button className="act" onClick={onShare}>
                <ShareIcon />
                {t('common.share')}
              </button>
            )}
          </div>
        )}
        {actions && <div className="post__acts">{actions}</div>}
      </div>
    </article>
  );
}
