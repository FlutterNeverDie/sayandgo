import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import QRCode from 'qrcode';
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
    hidden: false, hiddenBy: null, reportCount: 0, pinned: false, createdAt: ago(min),
  };
}

export function LandingPage() {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const [qrSvg, setQrSvg] = useState('');
  useEffect(() => {
    QRCode.toString(`${location.origin}/q/k7m2xp9a`, { type: 'svg', margin: 0, color: { dark: '#15201d', light: '#0000' } })
      .then(setQrSvg)
      .catch(() => undefined);
  }, []);
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
      <main className="page">
        <section className="hero" style={{ background: 'var(--surface)' }}>
          <h1 className="landing__title">{t('landing.title')}</h1>
          <p className="hero__intro" style={{ marginTop: 6 }}>
            {t('landing.lead')}
          </p>
          <div className="hero__actions">
            <Link to="/signup" className="btn btn--primary">
              {t('landing.start')}
            </Link>
          </div>
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
          <div className="hscroll hscroll--3">
            <div className="step">
              <div className="step__art">
                <div className="mini-poster">
                  <p>{examples[0].store.storeName}</p>
                  <span className="mini-poster__qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                  <span className="mini-poster__brand">{t('app.name')}</span>
                </div>
              </div>
              <h3 className="step__title">{t('landing.how1t')}</h3>
              <p className="step__desc">{t('landing.how1')}</p>
            </div>
            <div className="step">
              <div className="step__art" style={{ alignContent: 'center', justifyItems: 'stretch' }}>
                <div className="kind-chips" style={{ marginBottom: 8 }} aria-hidden="true">
                  <button tabIndex={-1}>{t('kind.question')}</button>
                  <button tabIndex={-1} aria-checked="true">{t('kind.complaint')}</button>
                </div>
                <p className="mini-text">{examples[2].q.body}</p>
                <p className="mini-lock">
                  <LockIcon size={14} />
                  {t('store.anonTitle')}
                </p>
              </div>
              <h3 className="step__title">{t('landing.how2t')}</h3>
              <p className="step__desc">{t('landing.how2')}</p>
            </div>
            <div className="step">
              <div className="step__art" style={{ alignContent: 'center', justifyItems: 'stretch' }}>
                <div className="qcard__a" style={{ margin: 0, ['--tone-soft' as string]: toneSoft(examples[2].store.tone, 0.18) }}>
                  <div className="qcard__a-head">
                    <StoreIcon category={examples[2].store.category} tone={examples[2].store.tone} size={22} />
                    <b>{examples[2].store.storeName}</b>
                  </div>
                  <p className="qcard__a-body" style={{ fontSize: 14 }}>{examples[2].q.answer?.body}</p>
                </div>
              </div>
              <h3 className="step__title">{t('landing.how3t')}</h3>
              <p className="step__desc">{t('landing.how3')}</p>
            </div>
          </div>
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

        <section className="section panel" style={{ display: 'grid', gap: 14, justifyItems: 'start' }}>
          <p style={{ fontSize: 17, fontWeight: 700 }}>{t('landing.closing')}</p>
          <Link to="/signup" className="btn btn--primary">
            {t('landing.start')}
          </Link>
        </section>

        <Footer />
      </main>
    </>
  );
}
