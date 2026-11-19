import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../app/auth';
import { HeroCarousel } from '../components/landing/HeroScenes';
import { Footer, PublicTopbar } from '../components/ui/Layout';
import type { QuestionKind } from '../lib/types';

type Ex = { name: string; kind: QuestionKind; q: string; a: string };

/** 홈: QR 스탠드 그림 → 한 줄 설명 · 시작 버튼 → 손님 쪽지 예시 → 자주 묻는 질문 */
export function LandingPage() {
  const { t } = useTranslation();
  const { user, ready } = useAuth();

  useEffect(() => {
    document.body.classList.add('warm');
    return () => document.body.classList.remove('warm');
  }, []);

  if (ready && user?.emailVerified) return <Navigate to="/inbox" replace />;

  const examples = t('landing.examples', { returnObjects: true }) as Ex[];
  const notes = examples.filter((e) => e.kind === 'complaint' || e.kind === 'suggestion').slice(0, 3);
  const faqs = [2, 3, 4];

  return (
    <>
      <PublicTopbar end={<Link to="/login" className="btn btn--text btn--sm">{t('landing.login')}</Link>} />
      <main className="page">
        <HeroCarousel name={examples[0].name} />

        <section className="home-lead">
          <h1 className="landing__title">{t('landing.titleV2')}</h1>
          <p className="landing__lead">{t('landing.leadV2')}</p>
          <Link to="/signup" className="btn btn--black btn--block btn--lg" style={{ marginTop: 18 }}>
            {t('landing.start')}
          </Link>
        </section>

        <section className="section" aria-labelledby="notes-h">
          <h2 id="notes-h" className="section__title">
            {t('landing.notesTitle')}
          </h2>
          <div className="notes">
            {notes.map((n) => (
              <div key={n.q} className="note">
                <small>
                  {n.name} · {t(`kind.${n.kind}`)}
                </small>
                <p>{n.q}</p>
                <p className="note__re">
                  {t('landing.ownerSays')} {n.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="section" aria-labelledby="faq-h">
          <h2 id="faq-h" className="section__title">
            {t('landing.faqTitle')}
          </h2>
          <div className="faq-list">
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
    </>
  );
}
