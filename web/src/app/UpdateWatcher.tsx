import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/** 지금 실행 중인 앱 번들 주소 (빌드마다 파일명 해시가 바뀐다) */
function currentBundle(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return el ? new URL(el.src).pathname : null;
}

/**
 * 새 버전 배포 감지: 앱이 다시 화면에 보일 때(5분에 한 번까지) index.html을 확인하고,
 * 새 버전이면 다음 화면 이동 때 새로고침한다. 글 쓰는 도중엔 새로고침하지 않는다.
 */
export function UpdateWatcher() {
  const location = useLocation();
  const stale = useRef(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    const mine = currentBundle();
    if (!mine) return; // 개발 서버
    const check = async () => {
      if (document.hidden || stale.current || Date.now() - lastCheck.current < 5 * 60_000) return;
      lastCheck.current = Date.now();
      try {
        const html = await (await fetch('/', { cache: 'no-store' })).text();
        const latest = html.match(/\/assets\/index-[^"']+\.js/)?.[0];
        if (latest && latest !== mine) stale.current = true;
      } catch {
        /* 오프라인이면 다음에 */
      }
    };
    lastCheck.current = Date.now();
    document.addEventListener('visibilitychange', check);
    const timer = setInterval(check, 10 * 60_000);
    return () => {
      document.removeEventListener('visibilitychange', check);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (stale.current) window.location.reload();
  }, [location.pathname]);

  return null;
}
