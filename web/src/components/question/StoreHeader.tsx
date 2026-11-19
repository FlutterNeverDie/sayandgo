import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LockIcon } from '../ui/Icons';
import type { StoreLook } from './QuestionItem';

/** 가게 머리 (에스크식 프로필): 상호명 · 소개 · 익명 보장 · 답변 수 · 버튼 */
export function StoreHeader({ store, intro, answered, asked, extra, invite, actions, headerRef }: {
  store: StoreLook;
  intro?: string;
  answered?: number | null;
  /** 받은 질문 수. 손님 화면은 셀 수 없어 넘기지 않는다 */
  asked?: number | null;
  extra?: ReactNode;
  /** 버튼 위에 놓는 사장님의 한마디 (손님 화면) */
  invite?: string;
  actions?: ReactNode;
  headerRef?: React.Ref<HTMLElement>;
}) {
  const { t } = useTranslation();
  return (
    <header className="prof" ref={headerRef}>
      <h1 className="prof__name">{store.storeName}</h1>
      {intro && <p className="prof__intro">{intro}</p>}
      <p className="prof__meta">
        <span className="prof__lock">
          <LockIcon size={14} />
          {t('store.anonShort')}
        </span>
        {answered != null && (
          <>
            {' · '}
            {t('store.statsA')} <b className="num">{answered}</b>
          </>
        )}
        {asked != null && (
          <>
            {' · '}
            {t('store.statsQ')} <b className="num">{asked}</b>
          </>
        )}
        {extra}
      </p>
      {invite && <p className="prof__invite">{invite}</p>}
      {actions && <div className="prof__btns">{actions}</div>}
    </header>
  );
}

/** 요소가 화면 위로 지나갔는지 (상단 바 상호명 · 따라오는 버튼용) */
export function useScrolledPast<T extends Element>() {
  const ref = useRef<T>(null);
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPast(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, past] as const;
}
