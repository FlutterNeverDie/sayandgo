import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';

/** 실제로 찍히는 QR (예시 가게 주소) */
function useQrSvg(url: string) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#15201d', light: '#ffffff' } })
      .then(setSvg)
      .catch(() => undefined);
  }, [url]);
  return svg;
}

/** 앱이 출력해 주는 QR 포스터와 같은 구성 */
function Poster({ name, svg }: { name: string; svg: string }) {
  const { t } = useTranslation();
  return (
    <div className="hp-poster">
      <b>{name}</b>
      <span className="hp-poster__qr" dangerouslySetInnerHTML={{ __html: svg }} />
      <p>{t('share.qrCaption')}</p>
      <div className="hp-poster__band">{t('app.name')}</div>
    </div>
  );
}

/** A: 테이블 위에 출력해서 세워 둔 QR */
export function HeroSceneA({ name }: { name: string }) {
  const svg = useQrSvg(`${location.origin}/q/k7m2xp9a`);
  return (
    <div className="hp-a" aria-hidden="true">
      <div className="hp-a__edge" />
      <div className="hp-a__table" />
      <div className="hp-a__saucer" />
      <div className="hp-a__cup" />
      <div className="hp-a__stand">
        <Poster name={name} svg={svg} />
        <div className="hp-a__foot" />
      </div>
    </div>
  );
}

/** B: 손님이 QR을 찍어 가게 페이지가 열린 휴대폰 */
export function HeroSceneB({ name }: { name: string }) {
  const { t } = useTranslation();
  const svg = useQrSvg(`${location.origin}/q/k7m2xp9a`);
  return (
    <div className="hp-b" aria-hidden="true">
      <div className="hp-b__back">
        <Poster name={name} svg={svg} />
      </div>
      <div className="hp-b__phone">
        <div className="hp-b__screen">
          <p className="hp-b__name">{name}</p>
          <p className="hp-b__lock">{t('store.anonShort')} · {t('store.statsA')} 16</p>
          <div className="hp-b__invite">{t('store.invite')}</div>
          <div className="hp-b__btn">{t('store.ask')}</div>
          <div className="hp-b__q">
            <small>{t('kindNoun.complaint')}</small>
            {t('landing.heroSampleQ')}
          </div>
          <p className="hp-b__a">{t('landing.heroSampleA')}</p>
        </div>
      </div>
      <div className="hp-b__thumb" />
    </div>
  );
}

/** A → B 자동 슬라이드 (4초). 손가락으로 넘기면 잠깐 멈추고, 움직임 줄이기 설정이면 넘기지 않는다 */
export function HeroCarousel({ name }: { name: string }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const pausedUntil = useRef(0);
  const slides = 2;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / el.clientWidth));
    const pause = () => (pausedUntil.current = Date.now() + 8000);
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('pointerdown', pause);
    el.addEventListener('touchstart', pause, { passive: true });
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = reduce
      ? undefined
      : setInterval(() => {
          if (Date.now() < pausedUntil.current || document.hidden) return;
          const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % slides;
          el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
        }, 4000);
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('pointerdown', pause);
      el.removeEventListener('touchstart', pause);
      if (timer) clearInterval(timer);
    };
  }, []);

  return (
    <div className="hero-carousel">
      <div className="hero-carousel__track" ref={ref}>
        <div className="hero-carousel__slide">
          <HeroSceneA name={name} />
        </div>
        <div className="hero-carousel__slide">
          <HeroSceneB name={name} />
        </div>
      </div>
      <div className="hero-carousel__dots" role="tablist" aria-label={t('landing.heroDots')}>
        {Array.from({ length: slides }, (_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={index === i}
            aria-label={`${i + 1} / ${slides}`}
            onClick={() => {
              pausedUntil.current = Date.now() + 8000;
              ref.current?.scrollTo({ left: i * (ref.current?.clientWidth ?? 0), behavior: 'smooth' });
            }}
          />
        ))}
      </div>
    </div>
  );
}
