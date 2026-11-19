import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** 하단 시트 (데스크톱에선 가운데 대화상자). Esc · 바깥 누르면 닫힘. */
export function Sheet({ title, desc, onClose, children }: { title?: string; desc?: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus();
    };
  }, [onClose]);
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet__grip" />
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
