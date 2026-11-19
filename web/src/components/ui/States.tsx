import { useTranslation } from 'react-i18next';
import { AppMark } from './AppMark';

export function Loading({ error, onRetry }: { error?: boolean; onRetry?: () => void }) {
  const { t } = useTranslation();
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
    <div className="page-loading" aria-busy="true">
      <AppMark size={48} />
      <span className="page-loading__text">{t('common.loading')}</span>
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
