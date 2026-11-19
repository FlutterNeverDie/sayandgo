import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RequireOwner } from '../app/auth';
import { CopyIcon, DownloadIcon, ShareIcon } from '../components/ui/Icons';
import { OwnerShell } from '../components/ui/Layout';
import { useToast } from '../components/ui/Overlay';
import { canvasToBlob, makeQrPoster } from '../lib/qr';
import { storeUrl } from '../lib/storeCode';
import type { Store } from '../lib/types';

export function SharePage() {
  return <RequireOwner>{(store) => <Share store={store} />}</RequireOwner>;
}

/** 링크 · QR: 포스터 크게 → 저장 / 공유 → 링크 한 줄 */
function Share({ store }: { store: Store }) {
  const { t } = useTranslation();
  const toast = useToast();
  const url = storeUrl(store.code);
  const isLocal = /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname);
  const fileName = `sayandgo-${store.code}.png`;
  const [poster, setPoster] = useState<{ blob: Blob; src: string } | null>(null);

  useEffect(() => {
    let src = '';
    let alive = true;
    makeQrPoster({ storeName: store.storeName, url, caption: t('share.qrCaption'), brand: t('app.name') })
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
  }, [store.storeName, url, t, toast]);

  const file = poster ? new File([poster.blob], fileName, { type: 'image/png' }) : null;
  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  function copy() {
    navigator.clipboard
      .writeText(url)
      .then(() => toast(t('common.copied')))
      .catch(() => toast(t('errors.generic')));
  }

  // 문구 안에 주소를 넣는다: 이미지와 같이 보내면 많은 앱이 url 값을 버리고, title은 빈 줄로 붙는다
  const message = `${t('share.shareText', { name: store.storeName })}\n${url}`;

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
            <img src={poster.src} alt={`${store.storeName} QR`} width={1080} height={1350} />
          ) : (
            <div className="skeleton" style={{ width: '100%', aspectRatio: '1080 / 1350', borderRadius: 14 }} />
          )}
        </div>

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
        <p className="share-tip">{isLocal ? t('share.devNotice') : t('share.tip')}</p>

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
    </OwnerShell>
  );
}
