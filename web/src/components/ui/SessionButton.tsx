import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth, useMyStore } from '../../app/auth';
import { StoreIcon } from './StoreIcon';

/** 위쪽 바 오른쪽: 로그인 전엔 "로그인", 로그인 후엔 내 가게(누르면 받은 피드백) */
export function SessionButton() {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const { store } = useMyStore();
  if (!ready) return <span style={{ width: 64 }} />;
  if (!user) {
    return (
      <Link to="/login" className="btn btn--text btn--sm">
        {t('landing.login')}
      </Link>
    );
  }
  return (
    <Link to={user.emailVerified ? '/inbox' : '/verify'} className="session-btn" aria-label={t('nav.inbox')}>
      {store ? <StoreIcon category={store.category} tone={store.tone} size={24} round /> : null}
      <span>{store?.storeName ?? t('nav.inbox')}</span>
    </Link>
  );
}
