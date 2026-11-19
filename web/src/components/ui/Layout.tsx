import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';
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
export function PublicTopbar({ end }: { end?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <Link to="/" className="wordmark">
          {t('app.name')}
        </Link>
        <div className="topbar__end">
          <LanguageSelect />
          {end}
        </div>
      </div>
    </header>
  );
}

/** 사장님 화면: 상단 바(데스크톱 메뉴) + 하단 탭(휴대폰) */
export function OwnerShell({ storeName, openCount, children }: { storeName: string; openCount?: number; children: ReactNode }) {
  const { t } = useTranslation();
  const items = [
    { to: '/inbox', label: t('nav.inbox'), badge: openCount },
    { to: '/share', label: t('nav.share') },
    { to: '/settings', label: t('nav.settings') },
  ];
  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          <Link to="/inbox" className="wordmark">
            {t('app.name')}
          </Link>
          <span className="topbar__store">{storeName}</span>
          <nav className="topbar__end topbar__nav" aria-label="main">
            {items.map((i) => (
              <NavLink key={i.to} to={i.to}>
                {i.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      {children}
      <nav className="tabbar" aria-label="main">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to}>
            {i.label}
            {!!i.badge && <span className="badge num">{i.badge >= 10 ? '9+' : i.badge}</span>}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
