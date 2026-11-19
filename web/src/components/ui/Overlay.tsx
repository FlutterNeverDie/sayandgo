import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { CloseIcon } from './Icons';

/**
 * 하단 시트 (데스크톱에선 가운데 대화상자).
 * - Esc · 바깥 · ✕ · 브라우저 뒤로 가기로 닫힌다 (열 때 기록을 하나 쌓아 뒤로 가기가 페이지를 떠나지 않게)
 * - 열린 동안 뒤 페이지 스크롤을 고정하고, 닫으면 원래 위치로 돌려놓는다
 */
export function Sheet({ title, desc, onClose, children }: { title?: string; desc?: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const { t } = useTranslation();

  // 뒤로 가기 = 닫기
  useEffect(() => {
    if (!history.state?.sheet) history.pushState({ ...history.state, sheet: true }, '');
    const onPop = () => onCloseRef.current();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // 버튼으로 닫았으면 쌓아 둔 기록을 걷어 낸다. 다른 시트로 바로 넘어가는 경우는 그대로 둔다.
      setTimeout(() => {
        if (history.state?.sheet && !document.querySelector('.sheet')) history.back();
      }, 0);
    };
  }, []);

  // 포커스 · Esc · 스크롤 고정
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    const y = window.scrollY;
    const body = document.body.style;
    const saved = { position: body.position, top: body.top, width: body.width, overflow: body.overflow };
    Object.assign(body, { position: 'fixed', top: `-${y}px`, width: '100%', overflow: 'hidden' });
    return () => {
      document.removeEventListener('keydown', onKey);
      Object.assign(body, saved);
      window.scrollTo(0, y);
      prev?.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet__grip" />
        <button className="icon-btn sheet__close" onClick={onClose} aria-label={t('common.close')}>
          <CloseIcon />
        </button>
        {title && <h2 className="sheet__title">{title}</h2>}
        {desc && <p className="sheet__desc">{desc}</p>}
        {children}
      </div>
    </>,
    document.body,
  );
}

interface ToastItem {
  id: number;
  text: string;
  action?: { label: string; onClick: () => void };
  ms: number;
}

const ToastContext = createContext<(text: string, opts?: { action?: ToastItem['action']; ms?: number }) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const show = useCallback((text: string, opts: { action?: ToastItem['action']; ms?: number } = {}) => {
    setToast({ id: Date.now(), text, action: opts.action, ms: opts.ms ?? 2600 });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), toast.ms);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast &&
        createPortal(
          <div className="toast" role="status" key={toast.id}>
            <span>{toast.text}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.onClick();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
