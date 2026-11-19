import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { AppMark } from './AppMark';
import { BackIcon } from './Icons';
import { LanguageSelect } from './Fields';

export function Footer({ extra }: { extra?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <footer className="footer">
      {/* 자주 누르는 것(소개 · 문의)과 약관 · 정책을 나눠서, 휴대폰에서도 줄이 아무 데서나 끊기지 않게 */}
      <nav aria-label="footer" className="footer__main">
        <Link to="/">{t('legal.about')}</Link>
        <Link to="/contact">{t('legal.contact')}</Link>
        {extra}
      </nav>
      <nav aria-label="legal" className="footer__legal">
        <Link to="/terms">{t('legal.terms')}</Link>
        <Link to="/privacy">
          <strong>{t('legal.privacy')}</strong>
        </Link>
        <Link to="/policy">{t('legal.policy')}</Link>
        <Link to="/rights">{t('legal.rights')}</Link>
      </nav>
      <span>© {new Date().getFullYear()} {t('app.name')}</span>
    </footer>
  );
}

/** 공개 화면 상단: (뒤로) + 워드마크 + 언어 */
export function PublicTopbar({ end, title, showTitle, back }: { end?: ReactNode; title?: string; showTitle?: boolean; back?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // 앱 안에서 넘어왔으면 이전 화면으로, 링크로 바로 들어왔으면 홈으로
  const goBack = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/', { replace: true }));
  return (
    <header className="topbar">
      <div className="topbar__inner">
        {back && (
          <button type="button" className="icon-btn" aria-label={t('common.back')} style={{ marginLeft: -10, marginRight: 2 }} onClick={goBack}>
            <BackIcon />
          </button>
        )}
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
              <Link to="/" className="wordmark">
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
