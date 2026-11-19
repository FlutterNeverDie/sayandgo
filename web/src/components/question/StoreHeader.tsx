import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StoreIcon, toneSoft } from '../ui/StoreIcon';
import type { StoreLook } from './QuestionItem';

/** 가게 머리: 가게 색이 옅게 깔린 카드 + 아이콘 + 상호명 + 소개 + 칩 + 버튼 */
export function StoreHeader({ store, intro, chips, actions, headerRef, showIcon = true }: {
  store: StoreLook;
  intro?: string;
  chips?: ReactNode;
  actions?: ReactNode;
  headerRef?: React.Ref<HTMLElement>;
  showIcon?: boolean;
}) {
  return (
    <header className="hero" ref={headerRef} style={{ ['--tone-soft' as string]: toneSoft(store.tone, 0.18) }}>
      {showIcon && <StoreIcon category={store.category} tone={store.tone} size={64} />}
      <h1 className="hero__name" style={showIcon ? undefined : { marginTop: 0 }}>{store.storeName}</h1>
      {intro && <p className="hero__intro">{intro}</p>}
      {chips && <div className="hero__chips">{chips}</div>}
      {actions && <div className="hero__actions">{actions}</div>}
    </header>
  );
}

/** 요소가 화면 위로 지나갔는지 (상단 바에 상호명 띄우기용) */
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
