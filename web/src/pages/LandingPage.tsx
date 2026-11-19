import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../app/auth';
import { QuestionItem, type StoreLook } from '../components/question/QuestionItem';
import { LockIcon } from '../components/ui/Icons';
import { Footer, PublicTopbar } from '../components/ui/Layout';
import { StoreIcon, toneSoft } from '../components/ui/StoreIcon';
import type { Question, QuestionKind } from '../lib/types';

const ago = (min: number) => new Date(Date.now() - min * 60_000);

function sampleQ(id: string, kind: QuestionKind, body: string, answer: string, min: number): Question {
  return {
    id, body, kind, lang: 'ko', visibility: 'public', status: 'answered',
    answer: { body: answer, at: ago(min - 5), editedAt: null },
    hidden: false, hiddenBy: null, reportCount: 0, helpful: 0, pinned: false, createdAt: ago(min),
  };
}

export function LandingPage() {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  if (ready && user?.emailVerified) return <Navigate to="/inbox" replace />;

  type Ex = { name: string; category: StoreLook['category']; tone: string; intro: string; kind: QuestionKind; q: string; a: string };
  const examples = (t('landing.examples', { returnObjects: true }) as Ex[]).map((e, i) => ({
    store: { storeName: e.name, category: e.category, tone: e.tone } as StoreLook,
    intro: e.intro,
    q: sampleQ(`ex${i}`, e.kind, e.q, e.a, 60 + i * 97),
  }));
  const faqs = [2, 3, 4];

  return (
    <>
      <PublicTopbar end={<Link to="/login" className="btn btn--text btn--sm">{t('landing.login')}</Link>} />
      <main className="page" style={{ paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>
        <section className="landing-hero">
          <h1 className="landing__title">{t('landing.title')}</h1>
          <p className="landing__lead">{t('landing.lead')}</p>
        </section>

        <section className="section" aria-labelledby="ex-h">
          <h2 id="ex-h" className="section__title">
            {t('landing.examplesTitle')}
          </h2>
          <div className="hscroll">
            {examples.map((ex) => (
              <div key={ex.q.id} className="example">
                <div className="example__head" style={{ background: toneSoft(ex.store.tone, 0.18) }}>
                  <StoreIcon category={ex.store.category} tone={ex.store.tone} size={44} />
                  <div style={{ minWidth: 0 }}>
                    <p className="example__name">{ex.store.storeName}</p>
                    <p className="example__intro">{ex.intro}</p>
                  </div>
                </div>
                <QuestionItem q={ex.q} store={ex.store} />
              </div>
            ))}
          </div>
        </section>

        <section className="section" aria-labelledby="how-h">
          <h2 id="how-h" className="section__title">
            {t('landing.howTitle')}
          </h2>
          <ol className="menu-group steps">
            {[
              { icon: <QrGlyph />, title: t('landing.how1t'), desc: t('landing.how1') },
              { icon: <LockIcon size={20} />, title: t('landing.how2t'), desc: t('landing.how2') },
              { icon: <ReplyGlyph />, title: t('landing.how3t'), desc: t('landing.how3') },
            ].map((step) => (
              <li key={step.title} className="steps__row">
                <span className="steps__icon">{step.icon}</span>
                <span>
                  <span className="steps__title">{step.title}</span>
                  <span className="steps__desc">{step.desc}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="section" aria-labelledby="faq-h">
          <h2 id="faq-h" className="section__title">
            {t('landing.faqTitle')}
          </h2>
          <div className="menu-group">
            {faqs.map((n) => (
              <details key={n} className="faq">
                <summary>{t(`landing.faq${n}q`)}</summary>
                <p>{t(`landing.faq${n}a`)}</p>
              </details>
            ))}
          </div>
        </section>


        <Footer />
      </main>
      <div className="cta-bar">
        <div className="cta-bar__inner">
          <Link to="/signup" className="btn btn--primary">
            {t('landing.start')}
          </Link>
        </div>
      </div>
    </>
  );
}

function QrGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" />
    </svg>
  );
}

function ReplyGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16v11H9l-5 4V5Z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  );
}
