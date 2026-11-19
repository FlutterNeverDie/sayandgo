import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Footer, PublicTopbar } from '../components/ui/Layout';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <>
      <PublicTopbar />
      <main className="page">
        <div className="center-state">
          <h1>{t('notFound.title')}</h1>
          <Link to="/" className="btn">
            {t('notFound.home')}
          </Link>
        </div>
      </main>
    </>
  );
}

/** 약관 · 정책 문서 틀. 본문은 다음 단계에서 채운다. */
export function LegalPage({ kind }: { kind: 'terms' | 'privacy' | 'policy' | 'rights' }) {
  const { t } = useTranslation();
  return (
    <>
      <PublicTopbar />
      <main className="page">
        <div className="title-row">
          <h1 className="title">{t(`legal.${kind}`)}</h1>
        </div>
        <p className="subtitle">{t('legal.koreanOnly')}</p>
        <Footer />
      </main>
    </>
  );
}
