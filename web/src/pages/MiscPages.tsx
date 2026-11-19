import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Footer, PublicTopbar } from '../components/ui/Layout';
import { LEGAL, type LegalKind } from './legal/content';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <>
      <PublicTopbar />
      <main className="page page--fill">
        <div className="center-state center-state--big">
          <h1>{t('notFound.title')}</h1>
          <Link to="/" className="btn btn--line" style={{ marginTop: 8 }}>
            {t('notFound.home')}
          </Link>
        </div>
        <Footer />
      </main>
    </>
  );
}

/** 약관 · 정책 문서 (본문은 legal/content.tsx, 한국어본이 기준) */
export function LegalPage({ kind }: { kind: LegalKind }) {
  const { t, i18n } = useTranslation();
  return (
    <>
      <PublicTopbar />
      <main className="page page--grow">
        <div className="title-row">
          <h1 className="title">{t(`legal.${kind}`)}</h1>
        </div>
        {i18n.resolvedLanguage !== 'ko' && <p className="notice" style={{ marginBottom: 16 }}>{t('legal.koreanOnly')}</p>}
        <article className="legal grow">{LEGAL[kind]}</article>
        <Footer />
      </main>
    </>
  );
}
