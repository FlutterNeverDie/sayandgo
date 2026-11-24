import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppMark } from './AppMark';

export function Loading({ error, onRetry, label }: { error?: boolean; onRetry?: () => void; label?: string }) {
  const { t } = useTranslation();
  // 오래 걸리면 기다리는 중이라는 걸 한 번 더 알려 준다
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(timer);
  }, []);
  if (error) {
    return (
      <div className="page">
        <div className="center-state">
          <p>{t('common.loadFailed')}</p>
          {onRetry && (
            <button className="btn btn--sm" onClick={onRetry}>
              {t('common.retry')}
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="page-loading" aria-busy="true" role="status">
      <AppMark size={48} />
      <span className="page-loading__text">
        {label ?? t('common.loading')}
        <span className="loading-dots" aria-hidden="true">
          <i>.</i>
          <i>.</i>
          <i>.</i>
        </span>
      </span>
      <span className="page-loading__bar" aria-hidden="true">
        <span />
      </span>
      {slow && <span className="page-loading__slow">{t('common.loadingSlow')}</span>}
    </div>
  );
}

export function TicketSkeleton() {
  return (
    <div className="post" aria-hidden="true">
      <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 20 }} />
      <div>
        <div className="skeleton" style={{ width: 72, height: 12 }} />
        <div className="skeleton" style={{ width: '90%' }} />
        <div className="skeleton" style={{ width: '60%' }} />
      </div>
    </div>
  );
}

export function ErrorBox({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="error-box" role="alert">
      <span>{t('common.loadFailed')}</span>
      <button className="btn btn--sm" onClick={onRetry}>
        {t('common.retry')}
      </button>
    </div>
  );
}
