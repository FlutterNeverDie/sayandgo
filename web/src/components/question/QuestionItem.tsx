import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { relativeTime } from '../../lib/format';
import type { Question, Store } from '../../lib/types';
import { MoreIcon } from '../ui/Icons';
import { StoreIcon, toneSoft } from '../ui/StoreIcon';

export type StoreLook = Pick<Store, 'storeName' | 'category' | 'tone'>;

interface Props {
  q: Question;
  store: StoreLook;
  mine?: boolean;
  owner?: boolean;
  selected?: boolean;
  onMenu?: () => void;
  leading?: ReactNode;
  actions?: ReactNode;
}

const isLong = (s: string) => s.length > 180 || s.split('\n').length > 5;

/** 질문 카드: 종류 태그 + 질문, 아래에 가게 색이 깔린 답변 상자 */
export function QuestionItem({ q, store, mine, owner, selected, onMenu, leading, actions }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const long = !!q.answer && isLong(q.answer.body);
  const cls = ['qcard', q.hidden && 'qcard--hidden', selected && 'qcard--selected'].filter(Boolean).join(' ');

  return (
    <article className={cls}>
      <div className="qcard__head">
        {leading}
        <span className={`kind kind--${q.kind}`}>{t(`kind.${q.kind}`)}</span>
        {mine && <span className="pill pill--mine">{t('store.mine')}</span>}
        {owner && q.visibility === 'owner' && <span className="pill pill--hidden">{t('store.ownerOnly')}</span>}
        {owner && q.hidden && (
          <span className={`pill ${q.hiddenBy === 'owner' ? 'pill--hidden' : 'pill--danger'}`}>{t(`inbox.hiddenBy.${q.hiddenBy ?? 'owner'}`)}</span>
        )}
        <span className="spacer" />
        {!q.answer && <time dateTime={q.createdAt?.toISOString()}>{relativeTime(q.createdAt)}</time>}
        {onMenu && (
          <button className="icon-btn" onClick={onMenu} aria-label={t('common.menu')} style={{ margin: '-8px -10px -8px -4px' }}>
            <MoreIcon />
          </button>
        )}
      </div>

      <p className="qcard__q">{q.body}</p>

      {q.answer ? (
        <div className="qcard__a" style={{ ['--tone-soft' as string]: toneSoft(store.tone, 0.14) }}>
          <div className="qcard__a-head">
            <StoreIcon category={store.category} tone={store.tone} size={26} />
            <b>{store.storeName}</b>
            <span>· {relativeTime(q.answer.at)}</span>
            {q.answer.editedAt && <span>· {t('store.edited')}</span>}
          </div>
          <p className={`qcard__a-body${long && !expanded ? ' qcard__a-body--clamp' : ''}`}>{q.answer.body}</p>
          {long && (
            <button className="qcard__more" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
              {expanded ? t('store.less') : t('store.moreText')}
            </button>
          )}
        </div>
      ) : (
        !owner && <p className="qcard__waiting">{t('store.waiting')}</p>
      )}
      {actions && <div className="qcard__actions">{actions}</div>}
    </article>
  );
}
