import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * 새 화면으로 넘어가면 맨 위에서 시작한다 (아래쪽 링크를 눌러도 새 화면 위부터).
 * 뒤로 · 앞으로 가기(POP)는 건드리지 않아 보던 위치가 그대로 남는다.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const type = useNavigationType();
  useLayoutEffect(() => {
    if (type !== 'POP') window.scrollTo(0, 0);
  }, [pathname, type]);
  return null;
}
