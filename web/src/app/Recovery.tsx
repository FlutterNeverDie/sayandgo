import { Component, type ReactNode } from 'react';

const KEY = 'sayandgo:reloadedAt';

/** 배포로 옛 파일이 사라져 화면 조각을 못 불러오면 한 번 새로고침 (1분 안에 반복하지 않음) */
export function reloadOnceForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* 저장소를 못 쓰면 그냥 새로고침 */
  }
  window.location.reload();
  return true;
}

if (typeof window !== 'undefined') {
  // Vite가 나중에 불러오는 화면 조각을 못 찾을 때 보내는 신호
  window.addEventListener('vite:preloadError', (e) => {
    if (reloadOnceForNewVersion()) e.preventDefault();
  });
}

/** 어떤 오류가 나도 흰 화면 대신 "다시 불러오기" */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    const msg = String((error as Error)?.message ?? error);
    // 화면 조각 불러오기 실패면 새 버전을 받으러 바로 새로고침
    if (/dynamically imported module|Importing a module script failed|ChunkLoadError|Failed to fetch/i.test(msg)) reloadOnceForNewVersion();
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const ko = (navigator.language || '').startsWith('ko');
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', background: '#f2f4f3' }}>
        <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
          <p style={{ fontWeight: 700, fontSize: 18 }}>{ko ? '화면을 불러오지 못했어요' : "Couldn't load this screen"}</p>
          <button className="btn btn--black" onClick={() => window.location.reload()}>
            {ko ? '다시 불러오기' : 'Reload'}
          </button>
        </div>
      </div>
    );
  }
}
