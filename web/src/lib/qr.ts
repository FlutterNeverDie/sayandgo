import QRCode from 'qrcode';

const W = 1080;
const H = 1350;
const INK = '#15201d';
const MINT = '#3ccfae';
const FONT = '"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", sans-serif';

/** 긴 상호명은 최대 2줄, 넘치면 글자를 줄인다 */
function fitLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): { lines: string[]; size: number } {
  for (let size = 76; size >= 40; size -= 4) {
    ctx.font = `700 ${size}px ${FONT}`;
    const lines: string[] = [];
    let line = '';
    for (const ch of text) {
      const next = line + ch;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length <= 2) return { lines, size };
  }
  return { lines: [text.slice(0, 14) + '…'], size: 40 };
}

/** 출력용 QR 이미지: 상호명 + QR + 안내 문구 + 하단 민트 띠 */
export async function makeQrPoster(opts: { storeName: string; url: string; caption: string; brand: string }): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const { lines, size } = fitLines(ctx, opts.storeName, W - 160);
  ctx.font = `700 ${size}px ${FONT}`;
  const top = lines.length === 1 ? 170 : 140;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * size * 1.2));

  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, opts.url, {
    width: 720,
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: INK, light: '#ffffff' },
  });
  ctx.drawImage(qr, (W - 720) / 2, 270);

  ctx.font = `500 40px ${FONT}`;
  ctx.fillText(opts.caption, W / 2, 1090);

  ctx.fillStyle = MINT;
  ctx.fillRect(0, H - 130, W, 130);
  ctx.fillStyle = INK;
  ctx.font = `700 40px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(opts.brand, W / 2, H - 65);

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/png'));
}
