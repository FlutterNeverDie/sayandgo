import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../app/auth';
import { QuestionItem } from '../components/question/QuestionItem';
import { Footer, PublicTopbar } from '../components/ui/Layout';
import type { Question } from '../lib/types';

export function LandingPage() {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  if (ready && user?.emailVerified) return <Navigate to="/inbox" replace />;

  const sample: Question = {
    id: 'sample',
    body: t('landing.sampleQ'),
    lang: 'ko',
    kind: 'question',
    visibility: 'public',
    status: 'answered',
    answer: { body: t('landing.sampleA'), at: new Date(Date.now() - 20 * 60_000), editedAt: null },
    hidden: false,
    hiddenBy: null,
    reportCount: 0,
    pinned: false,
    createdAt: new Date(Date.now() - 2 * 3600_000),
  };
  const faqs = [1, 2, 3, 4];
  const sampleStore = { storeName: t('landing.sampleStore'), category: 'cafe' as const, tone: 'mint' as const };

  return (
    <>
      <PublicTopbar end={<Link to="/login" className="btn btn--text btn--sm">{t('landing.login')}</Link>} />
      <main className="page">
        <section style={{ padding: '40px 0 8px' }}>
          <h1 className="title" style={{ fontSize: 30, maxWidth: '16em' }}>
            {t('landing.title')}
          </h1>
          <p style={{ marginTop: 16, color: 'var(--muted)', maxWidth: '34em' }}>{t('landing.lead')}</p>
          <div className="btn-row" style={{ marginTop: 24 }}>
            <Link to="/signup" className="btn btn--primary">
              {t('landing.start')}
            </Link>
            <Link to="/login" className="btn">
              {t('landing.login')}
            </Link>
          </div>
        </section>

        <section className="section" aria-labelledby="sample-h">
          <h2 id="sample-h" className="section__title">
            {t('landing.sampleTitle')}
          </h2>
          <div className="feed" style={{ borderTop: '1px solid var(--rule)' }}>
            <QuestionItem q={sample} store={sampleStore} />
            <QuestionItem q={{ ...sample, id: 'sample2', kind: 'suggestion', body: t('landing.sampleQ2'), answer: { body: t('landing.sampleA2'), at: new Date(), editedAt: null }, createdAt: new Date(Date.now() - 40 * 60_000) }} store={sampleStore} />
          </div>
        </section>

        <section className="section" aria-labelledby="how-h">
          <h2 id="how-h" className="section__title">
            {t('landing.howTitle')}
          </h2>
          <ol className="panel divided" style={{ margin: 0, padding: '0 16px', listStylePosition: 'inside' }}>
            {[1, 2, 3].map((n) => (
              <li key={n} style={{ padding: '14px 0' }}>
                {t(`landing.how${n}`)}
              </li>
            ))}
          </ol>
        </section>

        <section className="section" aria-labelledby="faq-h">
          <h2 id="faq-h" className="section__title">
            {t('landing.faqTitle')}
          </h2>
          <div className="panel divided" style={{ padding: '0 16px' }}>
            {faqs.map((n) => (
              <details key={n} style={{ padding: '14px 0' }}>
                <summary style={{ fontWeight: 600, cursor: 'pointer' }}>{t(`landing.faq${n}q`)}</summary>
                <p style={{ marginTop: 8, color: 'var(--muted)' }}>{t(`landing.faq${n}a`)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="section" style={{ display: 'grid', gap: 16, justifyItems: 'start' }}>
          <p style={{ fontSize: 20, fontWeight: 700 }}>{t('landing.closing')}</p>
          <Link to="/signup" className="btn btn--primary">
            {t('landing.start')}
          </Link>
        </section>

        <Footer />
      </main>
    </>
  );
}
