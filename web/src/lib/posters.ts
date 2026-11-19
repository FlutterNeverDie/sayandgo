import QRCode from 'qrcode';

/** 포스터 디자인 5종 (링크 · QR 화면에서 고름) */
export type PosterType = 'A' | 'B' | 'C' | 'D' | 'E';
export const POSTER_TYPES: PosterType[] = ['A', 'B', 'C', 'D', 'E'];
/** 포스터 문구 언어 (앱 화면 언어와 별개. 외국 손님이 많은 매장용) */
export type PosterLang = 'ko' | 'en' | 'ja' | 'zh';
export const POSTER_LANGS: { code: PosterLang; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文 (简体)' },
];

const INK = '#15201d';
const MINT = '#3ccfae';
const MINT_INK = '#0b6b58';
const MUTED = '#5f6b67';
const FONT = '"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", sans-serif';

/** 포스터에 들어가는 문구 (화면 언어와 별개로 포스터 언어를 고른다) */
const TEXT = {
  ko: {
    caption: 'QR을 찍어 익명으로 피드백 부탁드려요',
    headline: '솔직한\n피드백\n부탁드려요',
    sub: '익명이에요. 누가 썼는지 아무도 몰라요.',
    sticker: '익명 피드백',
    fold: '여기를 접으세요',
  },
  en: {
    caption: 'Scan to leave us anonymous feedback',
    headline: 'Honest\nfeedback,\nplease',
    sub: "It's anonymous. Nobody knows who wrote it.",
    sticker: 'Anonymous feedback',
    fold: 'Fold here',
  },
  ja: {
    caption: 'QRを読み取って、匿名でご意見をお聞かせください',
    headline: '正直な\nご意見を\nください',
    sub: '匿名です。誰が書いたかは分かりません。',
    sticker: '匿名でご意見を',
    fold: 'ここで折ってください',
  },
  zh: {
    caption: '扫描二维码，匿名留下您的意见',
    headline: '请告诉我们\n真实的\n想法',
    sub: '完全匿名，没有人知道是谁写的。',
    sticker: '匿名反馈',
    fold: '沿此线折叠',
  },
};

export interface PosterInput {
  type: PosterType;
  lang: PosterLang;
  storeName: string;
  url: string;
  /** 사장님이 직접 고친 문구 (비우면 기본 문구) */
  caption?: string;
  brand: string;
}

/** 출력 크기 */
export const POSTER_SIZE: Record<PosterType, [number, number]> = {
  A: [1080, 1350],
  B: [1080, 1350],
  C: [1800, 600],
  D: [1240, 1754],
  E: [1080, 1080],
};

function captions(input: PosterInput): string[] {
  if (input.caption?.trim()) return [input.caption.trim()];
  return [(TEXT[input.lang] ?? TEXT.ko).caption];
}

const primary = (lang: PosterLang) => TEXT[lang] ?? TEXT.ko;

/** 한 단락을 폭에 맞게 나눈다: 띄어쓰기 단위로, 한 단어가 너무 길면 글자 단위로 */
function wrap(ctx: CanvasRenderingContext2D, para: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  const push = (word: string) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      return;
    }
    if (line) lines.push(line);
    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
      return;
    }
    line = '';
    for (const ch of word) {
      if (ctx.measureText(line + ch).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else line += ch;
    }
  };
  para.split(' ').filter(Boolean).forEach(push);
  lines.push(line);
  return lines;
}

/** 폭을 넘으면 줄을 나누고, maxLines를 넘으면 글자를 줄인다 */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight: number, maxLines: number, min = 24) {
  for (let s = size; s >= min; s -= 2) {
    ctx.font = `${weight} ${s}px ${FONT}`;
    const lines = text.split('\n').flatMap((para) => wrap(ctx, para, maxWidth));
    if (lines.length <= maxLines) return { lines, size: s };
  }
  ctx.font = `${weight} ${min}px ${FONT}`;
  return { lines: [text.slice(0, 18) + '…'], size: min };
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) {
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

async function qrCanvas(url: string, size: number) {
  const c = document.createElement('canvas');
  await QRCode.toCanvas(c, url, { width: size, margin: 0, errorCorrectionLevel: 'M', color: { dark: INK, light: '#ffffff' } });
  return c;
}

/** 포스터 한 장을 캔버스로 그린다 */
export async function renderPoster(input: PosterInput): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const [W, H] = POSTER_SIZE[input.type];
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  const caps = captions(input);

  if (input.type === 'A') {
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    const name = fit(ctx, input.storeName, W - 160, 76, 700, 2);
    ctx.font = `700 ${name.size}px ${FONT}`;
    drawLines(ctx, name.lines, W / 2, name.lines.length === 1 ? 170 : 140, name.size * 1.2);
    ctx.drawImage(await qrCanvas(input.url, 700), (W - 700) / 2, 270);
    let y = 1060;
    caps.forEach((c, i) => {
      const f = fit(ctx, c, W - 140, i === 0 ? 42 : 30, i === 0 ? 600 : 500, 2);
      ctx.fillStyle = i === 0 ? INK : MUTED;
      ctx.font = `${i === 0 ? 600 : 500} ${f.size}px ${FONT}`;
      y = drawLines(ctx, f.lines, W / 2, y, f.size * 1.3) + 6;
    });
    ctx.fillStyle = MINT;
    ctx.fillRect(0, H - 120, W, 120);
    ctx.fillStyle = INK;
    ctx.font = `800 40px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(input.brand, W / 2, H - 60);
  }

  if (input.type === 'B') {
    const t = primary(input.lang);
    ctx.textAlign = 'left';
    const head = fit(ctx, input.caption?.trim() || t.headline, W - 180, 130, 900, 4, 64);
    ctx.font = `900 ${head.size}px ${FONT}`;
    head.lines.forEach((l, i) => {
      ctx.fillStyle = i === 1 && !input.caption?.trim() ? MINT_INK : INK;
      ctx.fillText(l, 90, 220 + i * head.size * 1.08);
    });
    const sub = fit(ctx, t.sub, W - 180, 34, 500, 2, 24);
    ctx.fillStyle = MUTED;
    ctx.font = `500 ${sub.size}px ${FONT}`;
    drawLines(ctx, sub.lines, 90, 220 + head.lines.length * head.size * 1.08 + 10, sub.size * 1.35);
    ctx.drawImage(await qrCanvas(input.url, 380), 90, H - 120 - 60 - 380);
    ctx.fillStyle = INK;
    ctx.textAlign = 'right';
    const name = fit(ctx, input.storeName, 460, 52, 800, 3);
    ctx.font = `800 ${name.size}px ${FONT}`;
    const ny = H - 120 - 60 - name.lines.length * name.size * 1.2 + name.size;
    drawLines(ctx, name.lines, W - 90, ny, name.size * 1.2);
    ctx.fillStyle = MINT;
    ctx.fillRect(0, H - 120, W, 120);
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.font = `800 40px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(input.brand, W / 2, H - 60);
  }

  if (input.type === 'C') {
    ctx.fillStyle = MINT;
    ctx.fillRect(0, 0, 44, H);
    ctx.drawImage(await qrCanvas(input.url, 460), 110, 70);
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    const x = 640;
    const name = fit(ctx, input.storeName, W - x - 80, 78, 800, 2);
    ctx.font = `800 ${name.size}px ${FONT}`;
    let y = drawLines(ctx, name.lines, x, 170, name.size * 1.2) + 10;
    caps.forEach((c, i) => {
      const f = fit(ctx, c, W - x - 80, i === 0 ? 46 : 32, i === 0 ? 600 : 500, 2);
      ctx.fillStyle = i === 0 ? INK : MUTED;
      ctx.font = `${i === 0 ? 600 : 500} ${f.size}px ${FONT}`;
      y = drawLines(ctx, f.lines, x, y + 10, f.size * 1.3);
    });
    ctx.fillStyle = MINT;
    roundRect(ctx, x, H - 130, 210, 64, 14);
    ctx.fillStyle = INK;
    ctx.font = `800 32px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(input.brand, x + 105, H - 98);
  }

  if (input.type === 'D') {
    const half = async (flip: boolean) => {
      ctx.save();
      if (flip) {
        ctx.translate(W, H / 2);
        ctx.rotate(Math.PI);
      } else ctx.translate(0, H / 2);
      const h = H / 2;
      ctx.drawImage(await qrCanvas(input.url, 460), 80, (h - 460) / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = INK;
      const x = 590;
      const name = fit(ctx, input.storeName, W - x - 70, 64, 800, 3);
      ctx.font = `800 ${name.size}px ${FONT}`;
      let y = drawLines(ctx, name.lines, x, h / 2 - 90, name.size * 1.2);
      caps.forEach((c, i) => {
        const f = fit(ctx, c, W - x - 70, i === 0 ? 38 : 28, i === 0 ? 600 : 500, 3);
        ctx.fillStyle = i === 0 ? INK : MUTED;
        ctx.font = `${i === 0 ? 600 : 500} ${f.size}px ${FONT}`;
        y = drawLines(ctx, f.lines, x, y + 14, f.size * 1.3);
      });
      ctx.fillStyle = MINT;
      roundRect(ctx, x, y + 24, 180, 56, 12);
      ctx.fillStyle = INK;
      ctx.font = `800 28px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(input.brand, x + 90, y + 52);
      ctx.restore();
    };
    await half(true);
    await half(false);
    // 접는 선
    ctx.strokeStyle = '#b9c2be';
    ctx.setLineDash([16, 14]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, H / 2);
    ctx.lineTo(W - 40, H / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    const label = ` ${primary(input.lang).fold} `;
    ctx.font = `500 26px ${FONT}`;
    const lw = ctx.measureText(label).width;
    ctx.fillRect(W / 2 - lw / 2, H / 2 - 20, lw, 40);
    ctx.fillStyle = '#8a9490';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, W / 2, H / 2);
  }

  if (input.type === 'E') {
    ctx.fillStyle = INK;
    roundRect(ctx, 0, 0, W, H, 120);
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, (W - 600) / 2, 150, 600, 600, 60);
    ctx.drawImage(await qrCanvas(input.url, 500), (W - 500) / 2, 200);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const label = input.caption?.trim() || primary(input.lang).sticker;
    const f = fit(ctx, label, W - 200, 58, 800, 1, 30);
    ctx.font = `800 ${f.size}px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(f.lines[0], W / 2, 860);
    ctx.fillStyle = MINT;
    ctx.font = `800 44px ${FONT}`;
    ctx.fillText(input.brand, W / 2, 940);
  }

  return canvas;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/png'));
}
