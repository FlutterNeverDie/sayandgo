import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RequireOwner } from '../app/auth';
import { OwnerShell } from '../components/ui/Layout';
import { useToast } from '../components/ui/Overlay';
import { canvasToBlob, makeQrPoster } from '../lib/qr';
import { storeUrl } from '../lib/storeCode';
import type { Store } from '../lib/types';

export function SharePage() {
  return <RequireOwner>{(store) => <Share store={store} />}</RequireOwner>;
}

function Share({ store }: { store: Store }) {
  const { t } = useTranslation();
  const toast = useToast();
  const url = storeUrl(store.code);
  const isLocal = /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname);
  const fileName = `qplace-${store.code}.png`;
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

  return (
    <OwnerShell storeName={store.storeName}>
      <main className="page">
        <div className="title-row" style={{ display: 'block' }}>
          <h1 className="title">{t('share.title')}</h1>
          <p className="subtitle" style={{ marginTop: 4 }}>
            {t('share.desc')}
          </p>
        </div>

        <section aria-labelledby="link-h">
          <h2 id="link-h" className="section__title">
            {t('share.link')}
          </h2>
          <div className="input-group">
            <input className="input" readOnly value={url} aria-label={t('share.link')} onFocus={(e) => e.target.select()} />
            <button
              className="btn"
              onClick={() =>
                navigator.clipboard
                  .writeText(url)
                  .then(() => toast(t('common.copied')))
                  .catch(() => toast(t('errors.generic')))
              }
            >
              {t('common.copy')}
            </button>
          </div>
          {'share' in navigator && (
            <button
              className="btn btn--block"
              style={{ marginTop: 8 }}
              onClick={() => navigator.share({ title: store.storeName, text: t('share.shareText', { name: store.storeName }), url }).catch(() => undefined)}
            >
              {t('share.nativeShare')}
            </button>
          )}
        </section>

        <section className="section" aria-labelledby="qr-h">
          <h2 id="qr-h" className="section__title">
            {t('share.qrTitle')}
          </h2>
          <p className="subtitle" style={{ marginBottom: 12 }}>
            {t('share.qrDesc')}
          </p>
          {isLocal && (
            <p className="notice" style={{ marginBottom: 12 }}>
              {t('share.devNotice')}
            </p>
          )}
          <div className="panel" style={{ padding: 12, display: 'grid', placeItems: 'center' }}>
            {poster ? (
              <img src={poster.src} alt={`${store.storeName} QR`} width={1080} height={1350} style={{ width: '100%', maxWidth: 360, height: 'auto' }} />
            ) : (
              <div className="skeleton" style={{ width: '100%', maxWidth: 360, aspectRatio: '1080 / 1350' }} />
            )}
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <a className="btn btn--primary btn--block" href={poster?.src} download={fileName} aria-disabled={!poster} onClick={(e) => !poster && e.preventDefault()}>
              {t('share.savePng')}
            </a>
            {canShareFile && (
              <button className="btn btn--block" onClick={() => navigator.share({ files: [file!], title: store.storeName }).catch(() => undefined)}>
                {t('share.sharePng')}
              </button>
            )}
          </div>
        </section>
      </main>
    </OwnerShell>
  );
}
