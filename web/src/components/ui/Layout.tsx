import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AppMark } from './AppMark';
import { BackIcon } from './Icons';
import { LanguageSelect } from './Fields';

export function Footer({ extra }: { extra?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <footer className="footer">
      <nav aria-label="footer">
        <Link to="/">{t('legal.about')}</Link>
        <Link to="/terms">{t('legal.terms')}</Link>
        <Link to="/privacy">
          <strong>{t('legal.privacy')}</strong>
        </Link>
        <Link to="/policy">{t('legal.policy')}</Link>
        <Link to="/rights">{t('legal.rights')}</Link>
        {extra}
      </nav>
      <span>© {new Date().getFullYear()} {t('app.name')}</span>
    </footer>
  );
}

/** 공개 화면 상단: 워드마크 + 언어 */
export function PublicTopbar({ end, title, showTitle }: { end?: ReactNode; title?: string; showTitle?: boolean }) {
  const { t } = useTranslation();
  return (
    <header className="topbar">
      <div className="topbar__inner">
        {title && showTitle ? (
          <span className="topbar__title topbar__title--show">{title}</span>
        ) : (
          <Link to="/" className="wordmark">
            <AppMark size={26} />
            {t('app.name')}
          </Link>
        )}
        <div className="topbar__end">
          <LanguageSelect />
          {end}
        </div>
      </div>
    </header>
  );
}

/** 사장님 화면: 받은 질문함이 메인. 설정은 가게 머리의 설정 버튼, 들어간 화면은 뒤로 버튼 */
export function OwnerShell({ storeName, title, back, children }: { storeName: string; openCount?: number; title?: string; back?: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          {back ? (
            <>
              <Link to={back} className="icon-btn" aria-label={t('common.back')} style={{ marginLeft: -10 }}>
                <BackIcon />
              </Link>
              {title && <span className="topbar__heading">{title}</span>}
            </>
          ) : (
            <>
              <Link to="/inbox" className="wordmark">
                <AppMark size={26} />
                {t('app.name')}
              </Link>
              <span className="topbar__store">{storeName}</span>
            </>
          )}
        </div>
      </header>
      {children}
    </>
  );
}
