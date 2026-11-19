import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Footer, PublicTopbar } from '../components/ui/Layout';
import { CopyIcon, ShareIcon } from '../components/ui/Icons';
import { currentLang } from '../i18n';
import { useToast } from '../components/ui/Overlay';
import { CONTACT_EMAIL } from '../lib/contact';
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

/** 문의하기: 서비스에 대한 피드백 · 제안 · 제휴 · 오류 제보 등 어떤 연락이든 */
export function ContactPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const copy = () =>
    navigator.clipboard
      .writeText(CONTACT_EMAIL)
      .then(() => toast(t('common.copied')))
      .catch(() => toast(t('errors.generic')));
  // 연락처 공유: 공유 창이 없는 브라우저는 복사로 대신
  const share = () => {
    const text = `${t('contact.shareText', { lng: currentLang() })}\n${CONTACT_EMAIL}`;
    if (typeof navigator.share === 'function') navigator.share({ text }).catch(() => undefined);
    else copy();
  };
  return (
    <>
      <PublicTopbar back />
      <main className="page page--grow">
        <div className="title-row" style={{ display: 'block' }}>
          <h1 className="title">{t('contact.title')}</h1>
          <p className="subtitle contact-lead">{t('contact.lead')}</p>
        </div>
        <ul className="contact-topics">
          {(t('contact.topics', { returnObjects: true }) as string[]).map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <div className="grow">
          <button className="link-row" onClick={copy} aria-label={`${t('common.copy')} ${CONTACT_EMAIL}`}>
            <span className="link-row__url">{CONTACT_EMAIL}</span>
            <span className="link-row__copy">
              <CopyIcon />
              {t('common.copy')}
            </span>
          </button>
          <button type="button" className="btn btn--black btn--lg btn--block" style={{ marginTop: 12 }} onClick={share}>
            <ShareIcon size={18} />
            {t('common.share')}
          </button>
          <p className="field__hint" style={{ marginTop: 12 }}>
            {t('contact.note')}
          </p>
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
      <PublicTopbar back />
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
