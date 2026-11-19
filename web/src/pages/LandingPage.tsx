import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../app/auth';
import { SessionButton } from '../components/ui/SessionButton';
import { HeroCarousel } from '../components/landing/HeroScenes';
import { Footer, PublicTopbar } from '../components/ui/Layout';
import { ShareIcon } from '../components/ui/Icons';
import { useToast } from '../components/ui/Overlay';
import { currentLang } from '../i18n';
import type { QuestionKind } from '../lib/types';

type Ex = { name: string; kind: QuestionKind; q: string; a: string };

/** 홈: QR 스탠드 그림 → 한 줄 설명 · 시작 버튼 → 손님 쪽지 예시 → 자주 묻는 질문 */
export function LandingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  useEffect(() => {
    document.body.classList.add('warm');
    return () => document.body.classList.remove('warm');
  }, []);

  const examples = t('landing.examples', { returnObjects: true }) as Ex[];
  const notes = examples.filter((e) => e.kind === 'complaint' || e.kind === 'suggestion').slice(0, 3);
  const faqs = [2, 3, 4];
  const toast = useToast();

  // 서비스 공유: 공유 창이 없는 브라우저(PC 등)는 복사로 대신
  function shareService() {
    const text = `${t('landing.shareText', { lng: currentLang() })}\n${location.origin}`;
    if (typeof navigator.share === 'function') navigator.share({ text }).catch(() => undefined);
    else
      navigator.clipboard
        .writeText(text)
        .then(() => toast(t('common.copied')))
        .catch(() => toast(t('errors.generic')));
  }

  return (
    <>
      {/* 앱 안의 다른 화면(가게 페이지 아래 "소개" 등)에서 왔을 때만 뒤로 */}
      <PublicTopbar end={<SessionButton />} back={(window.history.state?.idx ?? 0) > 0} />
      <main className="page">
        <HeroCarousel name={examples[0].name} />

        <section className="home-lead">
          <h1 className="landing__title">{t('landing.titleV2')}</h1>
          <p className="landing__lead">{t('landing.leadV2')}</p>
          <Link to={user?.emailVerified ? '/share' : '/signup'} className="btn btn--black btn--block btn--lg" style={{ marginTop: 18 }}>
            {user?.emailVerified ? t('landing.myQr') : t('landing.start')}
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

        <section className="home-share" aria-labelledby="share-h">
          <p id="share-h">{t('landing.shareTitle')}</p>
          <button type="button" className="btn btn--line" onClick={shareService}>
            <ShareIcon size={18} />
            {t('landing.shareButton')}
          </button>
        </section>

        <Footer />
      </main>
    </>
  );
}
