import type { StoreCategory, StoreTone } from '../../lib/types';

/* 업종 아이콘: 사진 대신 쓰는 가게 얼굴. 코드 안 SVG라 저장 · 전송 비용이 없다. */
const PATHS: Record<StoreCategory, string> = {
  cafe: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Zm11 1h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c0 1 1 1.5 1 2.5M11.5 3.5c0 1 1 1.5 1 2.5M4 21h14',
  restaurant: 'M6 3v7a2 2 0 0 0 2 2v9M10 3v7a2 2 0 0 1-2 2M8 3v5M17 21V3c-2 1-3 3.5-3 7 0 1.5 1 2 3 2',
  bar: 'M6 4h12l-6 8-6-8ZM12 12v7M8 20h8M9 7.5h6',
  bakery: 'M4 15c0-5 3.6-9 8-9s8 4 8 9v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1ZM9 8.5l1.5 5M15 8.5l-1.5 5M12 7v6',
  pc: 'M3 5h18v11H3V5ZM8 20h8M12 16v4M7 10.5h3M8.5 9v3M15 10h.01M17 11.5h.01',
  beauty: 'M6 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM8 7l12 11M8 17 20 6',
  shop: 'M5 8h14l-1 12H6L5 8ZM9 8V6a3 3 0 0 1 6 0v2',
  other: 'M4 9.5 5.5 4h13L20 9.5M4 9.5h16M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5.5 12v8h13v-8M10 20v-4.5h4V20',
};

export const CATEGORIES = Object.keys(PATHS) as StoreCategory[];

export const TONES: Record<StoreTone, { bg: string; fg: string }> = {
  mint: { bg: '#3ccfae', fg: '#15201d' },
  lemon: { bg: '#f7d354', fg: '#15201d' },
  coral: { bg: '#ff9b85', fg: '#15201d' },
  sky: { bg: '#8cc8ff', fg: '#15201d' },
  sand: { bg: '#e8dcc8', fg: '#15201d' },
  ink: { bg: '#15201d', fg: '#ffffff' },
};

export function CategoryGlyph({ category, size = 24 }: { category: StoreCategory; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[category] ?? PATHS.other} />
    </svg>
  );
}

export function StoreIcon({ category, tone, size = 64 }: { category: StoreCategory; tone: StoreTone; size?: number }) {
  const c = TONES[tone] ?? TONES.mint;
  return (
    <span
      className="store-icon"
      style={{ width: size, height: size, background: c.bg, color: c.fg, borderRadius: Math.round(size * 0.3) }}
      aria-hidden="true"
    >
      <CategoryGlyph category={category} size={Math.round(size * 0.52)} />
    </span>
  );
}
