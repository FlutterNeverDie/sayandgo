import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StoreIcon } from '../ui/StoreIcon';
import type { StoreLook } from './QuestionItem';

/** 가게 머리: 아이콘 타일 + 상호명 + 소개 + 숫자 칩 + 버튼 */
export function StoreHeader({ store, intro, chips, actions, headerRef }: {
  store: StoreLook;
  intro?: string;
  chips?: ReactNode;
  actions?: ReactNode;
  headerRef?: React.Ref<HTMLElement>;
}) {
  return (
    <header className="profile" ref={headerRef}>
      <div className="profile__top">
        <StoreIcon category={store.category} tone={store.tone} size={64} />
        <div className="profile__text">
          <h1 className="profile__name">{store.storeName}</h1>
          {intro && <p className="profile__intro">{intro}</p>}
        </div>
      </div>
      {chips && <div className="profile__chips">{chips}</div>}
      {actions && <div className="profile__actions">{actions}</div>}
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
