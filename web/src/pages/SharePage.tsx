import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RequireOwner } from '../app/auth';
import { currentLang } from '../i18n';
import { CloseIcon, CopyIcon, DownloadIcon, ShareIcon, ZoomIcon } from '../components/ui/Icons';
import { OwnerShell } from '../components/ui/Layout';
import { Sheet, useToast } from '../components/ui/Overlay';
import {
  canvasToBlob,
  defaultTexts,
  POSTER_FIELDS,
  POSTER_LIMITS,
  POSTER_SIZE,
  POSTER_TYPES,
  renderPoster,
  type PosterField,
  type PosterTexts,
  type PosterType,
} from '../lib/posters';
import { storeUrl } from '../lib/storeCode';
import type { Store } from '../lib/types';
import { hasBannedWord } from '../lib/bannedWords';

/** 디자인마다 사장님이 고친 칸만 저장 (고치지 않은 칸은 기본 문구) */
type Custom = Partial<Record<PosterType, Partial<PosterTexts>>>;
interface Pref {
  type: PosterType;
  custom: Custom;
}

// 포스터 설정은 이 기기에만 저장한다 (서버 저장 없음). 가게별로 따로.
const prefKey = (code: string) => `sayandgo:poster:${code}`;

function readPref(code: string): Pref {
  const fallback: Pref = { type: 'A', custom: {} };
  try {
    localStorage.removeItem('sayandgo:poster'); // 예전 형식(언어 선택) 정리
    const saved = JSON.parse(localStorage.getItem(prefKey(code)) ?? '{}') as Partial<Pref>;
    return {
      type: saved.type && POSTER_TYPES.includes(saved.type) ? saved.type : fallback.type,
      custom: saved.custom && typeof saved.custom === 'object' ? saved.custom : {},
    };
  } catch {
    return fallback;
  }
}

const hasBanned = (texts: Partial<PosterTexts> = {}) => Object.values(texts).some((v) => !!v && hasBannedWord(v));

export function SharePage() {
  return <RequireOwner>{(store) => <Share store={store} />}</RequireOwner>;
}

/** 링크 · QR: 포스터 미리보기 → 디자인 · 언어 · 문구 → 저장 / 공유 → 링크 한 줄 */
function Share({ store }: { store: Store }) {
  const { t } = useTranslation();
  const toast = useToast();
  const url = storeUrl(store.code);
  const isLocal = /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname);
  const [pref, setPref] = useState<Pref>(() => readPref(store.code));
  // 그림에 반영하는 값: 입력을 멈추면 반영 (매 글자마다 다시 그리지 않게), 금칙어가 있으면 반영하지 않음
  const [applied, setApplied] = useState<Custom>(pref.custom);
  const [customizing, setCustomizing] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [poster, setPoster] = useState<{ blob: Blob; src: string } | null>(null);
  const fileName = `sayandgo-${store.code}-${pref.type}.png`;
  const defaults = defaultTexts(currentLang(), store.storeName);
  const mine = pref.custom[pref.type] ?? {};
  const isCustom = Object.keys(mine).length > 0;

  useEffect(() => {
    try {
      localStorage.setItem(prefKey(store.code), JSON.stringify(pref));
    } catch {
      /* 무시 */
    }
  }, [pref, store.code]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasBanned(pref.custom[pref.type])) setApplied(pref.custom);
    }, 400);
    return () => clearTimeout(timer);
  }, [pref.custom, pref.type]);

  /** 칸 하나 고치기. 기본 문구와 같아지면 '고친 칸'에서 뺀다 */
  function setField(k: PosterField, value: string) {
    setPref((p) => {
      const cur = { ...(p.custom[p.type] ?? {}) };
      if (value === defaults[k]) delete cur[k];
      else cur[k] = value;
      return { ...p, custom: { ...p.custom, [p.type]: cur } };
    });
  }
  /** 비운 채로 칸을 벗어나면 기본 문구로 되돌린다 */
  const restoreIfEmpty = (k: PosterField) => !(mine[k] ?? defaults[k]).trim() && setField(k, defaults[k]);
  const resetType = () => setPref((p) => ({ ...p, custom: { ...p.custom, [p.type]: {} } }));

  const appliedTexts = applied[pref.type] ?? {};
  const texts = Object.fromEntries(
    (Object.keys(defaults) as PosterField[]).map((k) => [k, appliedTexts[k]?.trim() || defaults[k]]),
  ) as unknown as PosterTexts;
  const textsKey = JSON.stringify(texts);

  useEffect(() => {
    let src = '';
    let alive = true;
    setPoster(null);
    renderPoster({ type: pref.type, texts: JSON.parse(textsKey) as PosterTexts, url, brand: t('app.name') })
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
  }, [pref.type, textsKey, url, t, toast]);

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
            <button type="button" className="qr-stage__btn" onClick={() => setZoom(true)} aria-label={t('share.zoom')}>
              <img src={poster.src} alt={`${store.storeName} QR`} width={w} height={h} className={`qr-stage__img qr-stage__img--${pref.type}`} />
            </button>
          ) : (
            <div className="skeleton qr-stage__img" style={{ aspectRatio: `${w} / ${h}`, width: '100%', maxWidth: pref.type === 'C' ? 340 : 300 }} />
          )}
        </div>

        <button type="button" className="poster-pick" onClick={() => setCustomizing(true)}>
          <span className={`poster-thumb poster-thumb--${pref.type}`} aria-hidden="true" />
          <span className="poster-pick__text">
            <b>{t('share.customize')}</b>
            <span>
              {t(`share.types.${pref.type}`)}
              {isCustom ? ` · ${t('share.customOn')}` : ''}
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
            {poster ? (
              <button type="button" className="poster-mini__btn" onClick={() => setZoom(true)} aria-label={t('share.zoom')}>
                <img src={poster.src} alt="" />
                <span className="poster-mini__zoom">
                  <ZoomIcon />
                  {t('share.zoom')}
                </span>
              </button>
            ) : (
              <div className="skeleton" style={{ aspectRatio: `${w} / ${h}`, height: '100%' }} />
            )}
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

          <div className="poster-fields">
            <div className="poster-fields__head">
              <p className="share-label">{t('share.texts')}</p>
              {isCustom && (
                <button type="button" className="text-btn" onClick={resetType}>
                  {t('share.resetType')}
                </button>
              )}
            </div>
            {POSTER_FIELDS[pref.type].map((k) => {
              const value = mine[k] ?? defaults[k];
              const error = value.trim() && hasBannedWord(value) ? t('errors.banned') : null;
              const common = {
                id: `pf-${k}`,
                value,
                maxLength: POSTER_LIMITS[k],
                onBlur: () => restoreIfEmpty(k),
                'aria-invalid': !!error,
              };
              return (
                <div className="field" key={`${pref.type}-${k}`}>
                  <label className="field__label" htmlFor={`pf-${k}`}>
                    {t(`share.fields.${k}`)}
                  </label>
                  <div className={`input-clear${k === 'headline' ? ' input-clear--top' : ''}`}>
                    {k === 'headline' ? (
                      <textarea
                        {...common}
                        className="textarea"
                        rows={3}
                        onChange={(e) => setField(k, e.target.value.split('\n').slice(0, 3).join('\n'))}
                      />
                    ) : (
                      <input {...common} className="input" onChange={(e) => setField(k, e.target.value)} />
                    )}
                    {value && (
                      <button type="button" className="input-clear__btn" onMouseDown={(e) => e.preventDefault()} onClick={() => setField(k, '')} aria-label={t('share.reset')}>
                        <CloseIcon />
                      </button>
                    )}
                  </div>
                  {error ? (
                    <p className="field__error">{error}</p>
                  ) : (
                    <p className="field__hint">
                      {value.length} / {POSTER_LIMITS[k]}
                    </p>
                  )}
                </div>
              );
            })}
            <p className="share-hint">{t('share.textsHint')}</p>
          </div>
          <button type="button" className="btn btn--black btn--lg" style={{ width: '100%', marginTop: 20 }} onClick={() => setCustomizing(false)}>
            {t('share.apply')}
          </button>
        </Sheet>
      )}
      {zoom && poster && <PosterZoom src={poster.src} onClose={() => setZoom(false)} />}
    </OwnerShell>
  );
}

/** 포스터 크게 보기: 화면 가득, 아무 데나 누르거나 Esc로 닫기 */
function PosterZoom({ src, onClose }: { src: string; onClose: () => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className="poster-zoom" role="dialog" aria-modal="true" aria-label={t('share.zoom')} onClick={onClose}>
      <img src={src} alt="" />
      <button type="button" className="poster-zoom__close" aria-label={t('common.close')}>
        <CloseIcon />
      </button>
    </div>
  );
}
