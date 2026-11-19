import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RequireOwner } from '../app/auth';
import { currentLang } from '../i18n';
import { CloseIcon, CopyIcon, DownloadIcon, ShareIcon } from '../components/ui/Icons';
import { OwnerShell } from '../components/ui/Layout';
import { Sheet, useToast } from '../components/ui/Overlay';
import { canvasToBlob, POSTER_SIZE, POSTER_TYPES, renderPoster, type PosterLang, type PosterType } from '../lib/posters';
import { storeUrl } from '../lib/storeCode';
import type { Store } from '../lib/types';
import { hasBannedWord } from '../lib/bannedWords';

const PREF_KEY = 'sayandgo:poster';
const CAPTION_MAX = 30;

interface Pref {
  type: PosterType;
  lang: PosterLang;
  caption: string;
}

function readPref(): Pref {
  const fallback: Pref = { type: 'A', lang: currentLang() === 'ko' ? 'ko' : 'en', caption: '' };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') };
  } catch {
    return fallback;
  }
}

export function SharePage() {
  return <RequireOwner>{(store) => <Share store={store} />}</RequireOwner>;
}

/** 링크 · QR: 포스터 미리보기 → 디자인 · 언어 · 문구 → 저장 / 공유 → 링크 한 줄 */
function Share({ store }: { store: Store }) {
  const { t } = useTranslation();
  const toast = useToast();
  const url = storeUrl(store.code);
  const isLocal = /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname);
  const [pref, setPref] = useState<Pref>(readPref);
  const [draft, setDraft] = useState(pref.caption);
  const [customizing, setCustomizing] = useState(false);
  const [poster, setPoster] = useState<{ blob: Blob; src: string } | null>(null);
  const fileName = `sayandgo-${store.code}-${pref.type}.png`;
  const captionError = draft.trim() && hasBannedWord(draft) ? t('errors.banned') : null;

  // 고른 디자인 · 언어 · 문구는 기기에 기억 (서버 저장 없음)
  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(pref));
    } catch {
      /* 무시 */
    }
  }, [pref]);

  // 문구는 입력을 멈추면 반영 (매 글자마다 다시 그리지 않게)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!captionError) setPref((p) => ({ ...p, caption: draft.trim() }));
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, captionError]);

  useEffect(() => {
    let src = '';
    let alive = true;
    setPoster(null);
    renderPoster({ type: pref.type, lang: pref.lang, caption: pref.caption, storeName: store.storeName, url, brand: t('app.name') })
      .then(canvasToBlob)
      .then((blob) => {
        if (!alive) return;
        src = URL.createObjectURL(blob);
        setPoster({ blob, src });
      })
      .catch(() => toast(t('errors.generic')));
    return () => {
      alive = false;
      if (src) URL.revokeObjectURL(src);
    };
  }, [pref.type, pref.lang, pref.caption, store.storeName, url, t, toast]);

  const file = poster ? new File([poster.blob], fileName, { type: 'image/png' }) : null;
  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  function copy() {
    navigator.clipboard
      .writeText(url)
      .then(() => toast(t('common.copied')))
      .catch(() => toast(t('errors.generic')));
  }

  // 문구 안에 주소를 넣는다: 이미지와 같이 보내면 많은 앱이 url 값을 버리고, title은 빈 줄로 붙는다
  const message = `${t('share.shareText', { name: store.storeName, lng: currentLang() })}\n${url}`;

  function share() {
    if (canShareFile) {
      navigator.share({ files: [file!], text: message }).catch(() => undefined);
    } else if (typeof navigator.share === 'function') {
      navigator.share({ text: message }).catch(() => undefined);
    } else {
      navigator.clipboard
        .writeText(message)
        .then(() => toast(t('common.copied')))
        .catch(() => toast(t('errors.generic')));
    }
  }

  const [w, h] = POSTER_SIZE[pref.type];

  return (
    <OwnerShell storeName={store.storeName} back="/inbox">
      <main className="page">
        <div className="title-row" style={{ display: 'block' }}>
          <h1 className="title">{t('share.title')}</h1>
          <p className="subtitle" style={{ marginTop: 4 }}>
            {t('share.desc')}
          </p>
        </div>

        <div className="qr-stage">
          {poster ? (
            <img src={poster.src} alt={`${store.storeName} QR`} width={w} height={h} className={`qr-stage__img qr-stage__img--${pref.type}`} />
          ) : (
            <div className="skeleton qr-stage__img" style={{ aspectRatio: `${w} / ${h}`, width: '100%', maxWidth: pref.type === 'C' ? 340 : 300 }} />
          )}
        </div>

        <button type="button" className="poster-pick" onClick={() => setCustomizing(true)}>
          <span className={`poster-thumb poster-thumb--${pref.type}`} aria-hidden="true" />
          <span className="poster-pick__text">
            <b>{t('share.customize')}</b>
            <span>
              {t(`share.types.${pref.type}`)} · {t(`share.langs.${pref.lang}`)}
              {pref.caption ? ` · ${t('share.customOn')}` : ''}
            </span>
          </span>
          <span className="poster-pick__go">{t('share.change')}</span>
        </button>

        <div className="share-actions">
          <a className="btn btn--black btn--lg" href={poster?.src} download={fileName} aria-disabled={!poster} onClick={(e) => !poster && e.preventDefault()}>
            <DownloadIcon />
            {t('share.savePng')}
          </a>
          <button className="btn btn--line btn--lg" onClick={share}>
            <ShareIcon size={18} />
            {t('common.share')}
          </button>
        </div>
        <p className="share-tip">{isLocal ? t('share.devNotice') : pref.type === 'D' ? t('share.tipD') : t('share.tip')}</p>

        <section className="section" aria-labelledby="link-h" style={{ marginTop: 32 }}>
          <h2 id="link-h" className="section__title">
            {t('share.link')}
          </h2>
          <button className="link-row" onClick={copy} aria-label={`${t('common.copy')} ${url}`}>
            <span className="link-row__url">{url.replace(/^https?:\/\//, '')}</span>
            <span className="link-row__copy">
              <CopyIcon />
              {t('common.copy')}
            </span>
          </button>
        </section>
      </main>
      {customizing && (
        <Sheet title={t('share.customize')} onClose={() => setCustomizing(false)}>
          <div className="poster-mini">
            {poster ? <img src={poster.src} alt="" /> : <div className="skeleton" style={{ aspectRatio: `${w} / ${h}`, height: '100%' }} />}
          </div>
          <p className="share-label">{t('share.design')}</p>
          <div className="poster-types" role="radiogroup" aria-label={t('share.design')}>
            {POSTER_TYPES.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={pref.type === k} onClick={() => setPref((p) => ({ ...p, type: k }))}>
                <span className={`poster-thumb poster-thumb--${k}`} aria-hidden="true" />
                <b>{k}</b>
                <span>{t(`share.types.${k}`)}</span>
              </button>
            ))}
          </div>
          <p className="share-hint">{t(`share.typeHints.${pref.type}`)}</p>

          <div className="field" style={{ marginTop: 20 }}>
            <label className="field__label" htmlFor="poster-caption">
              {t('share.customCaption')}
            </label>
            <div className="input-clear">
              <input
                id="poster-caption"
                className="input"
                value={draft}
                maxLength={CAPTION_MAX}
                placeholder={t('share.customPlaceholder')}
                onChange={(e) => setDraft(e.target.value)}
                aria-invalid={!!captionError}
              />
              {draft && (
                <button type="button" className="input-clear__btn" onClick={() => setDraft('')} aria-label={t('share.reset')}>
                  <CloseIcon />
                </button>
              )}
            </div>
            {captionError ? <p className="field__error">{captionError}</p> : <p className="field__hint">{t('share.customHint', { n: draft.trim().length, max: CAPTION_MAX })}</p>}
          </div>


          <p className="share-label">{t('share.captionLang')}</p>
          <div className="segmented" role="radiogroup" aria-label={t('share.captionLang')}>
            {(['ko', 'en', 'both'] as PosterLang[]).map((l) => (
              <button key={l} type="button" role="radio" aria-selected={pref.lang === l} onClick={() => setPref((p) => ({ ...p, lang: l }))}>
                {t(`share.langs.${l}`)}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--black btn--lg" style={{ width: '100%', marginTop: 20 }} onClick={() => setCustomizing(false)}>
            {t('share.apply')}
          </button>
        </Sheet>
      )}
    </OwnerShell>
  );
}
