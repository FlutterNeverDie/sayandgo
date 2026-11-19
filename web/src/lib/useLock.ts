import { useCallback, useRef, useState } from 'react';

/**
 * 연타 막기: 실행 중이면 다음 호출은 그냥 무시한다.
 * ref로 막아서 같은 순간에 두 번 눌려도(화면이 다시 그려지기 전) 한 번만 나간다. busy로 버튼도 잠근다.
 */
export function useLock() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (lock.current) return undefined;
    lock.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, run };
}

/** 항목별 연타 막기 (예: 글마다 도움됐어요). 같은 키가 처리 중이면 무시 */
export function useKeyedLock() {
  const keys = useRef(new Set<string>());
  return useCallback(async (key: string, fn: () => Promise<void>) => {
    if (keys.current.has(key)) return;
    keys.current.add(key);
    try {
      await fn();
    } finally {
      keys.current.delete(key);
    }
  }, []);
}
