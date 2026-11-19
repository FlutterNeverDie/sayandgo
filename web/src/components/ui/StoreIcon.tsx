import type { StoreCategory } from '../../lib/types';

/* 업종 아이콘: 사진 대신 쓰는 가게 얼굴. 코드 안 SVG라 저장 · 전송 비용이 없다. */
const PATHS: Record<StoreCategory, string> = {
  cafe: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Zm11 1h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c0 1 1 1.5 1 2.5M11.5 3.5c0 1 1 1.5 1 2.5M4 21h14',
  restaurant: 'M6 3v7a2 2 0 0 0 2 2v9M10 3v7a2 2 0 0 1-2 2M8 3v5M17 21V3c-2 1-3 3.5-3 7 0 1.5 1 2 3 2',
  bar: 'M6 4h12l-6 8-6-8ZM12 12v7M8 20h8M9 7.5h6',
  bakery: 'M4 15c0-5 3.6-9 8-9s8 4 8 9v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1ZM9 8.5l1.5 5M15 8.5l-1.5 5M12 7v6',
  pc: 'M3 5h18v11H3V5ZM8 20h8M12 16v4M7 10.5h3M8.5 9v3M15 10h.01M17 11.5h.01',
  beauty: 'M6 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM8 7l12 11M8 17 20 6',
  shop: 'M5 8h14l-1 12H6L5 8ZM9 8V6a3 3 0 0 1 6 0v2',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6',
  other: 'M4 9.5 5.5 4h13L20 9.5M4 9.5h16M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5.5 12v8h13v-8M10 20v-4.5h4V20',
  flower: 'M12 13c-3 0-5-2-5-6l2.5 1.5L12 5l2.5 3L17 7c0 4-2 6-5 6ZM12 13v8M12 18c-2-1.5-4-1.5-5-1M12 18c2-1.5 4-1.5 5-1',
  fitness: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  study: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v14H6.5A1.5 1.5 0 0 0 5 18.5v-14ZM5 18.5A1.5 1.5 0 0 0 6.5 20H19v-3M9 7h6M9 10h4',
  karaoke: 'M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3ZM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6',
  pet: 'M12 20c-3 0-5-1.5-5-3.5S9.5 12 12 12s5 2.5 5 4.5-2 3.5-5 3.5ZM7.6 10a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 1 1 3.2 0ZM11.1 6.5a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 1 1 3.2 0ZM16.1 6.5a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 1 1 3.2 0ZM19.6 10a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 1 1 3.2 0Z',
  stay: 'M3 19V6M3 14h18v5M21 14v-1.5A2.5 2.5 0 0 0 18.5 10H11v4M6.5 12.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z',
  car: 'M5 16v-4.5L7 6.5h10l2 5V16M3.5 16h17M6 16v2.5M18 16v2.5M5 11.5h14M7.5 13.5h.01M16.5 13.5h.01',
};

/** 처음 보이는 8개 + "아이콘 더보기"로 보이는 8개. firestore.rules의 목록과 같아야 한다. */
export const CATEGORIES_MAIN: StoreCategory[] = ['cafe', 'restaurant', 'bar', 'bakery', 'pc', 'beauty', 'shop', 'person'];
export const CATEGORIES_MORE: StoreCategory[] = ['other', 'flower', 'fitness', 'study', 'karaoke', 'pet', 'stay', 'car'];

/** 미리 정한 색 12개. 이 밖의 색은 직접 고르기(#rrggbb). */
export const PRESET_TONES = [
  '#3ccfae', '#8fd16a', '#2e6b4f', '#f7d354', '#ffb35c', '#ff9b85',
  '#f7a8c4', '#8cc8ff', '#2f7fd8', '#e8dcc8', '#8b5e3c', '#15201d',
];

/** 예전 이름 값 → 색 코드 */
export const LEGACY_TONES: Record<string, string> = {
  mint: '#3ccfae', lemon: '#f7d354', coral: '#ff9b85', sky: '#8cc8ff', sand: '#e8dcc8', ink: '#15201d',
};

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** 배경이 밝으면 진한 글자, 어두우면 흰 글자 */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.35 ? '#15201d' : '#ffffff';
}

export function CategoryGlyph({ category, size = 24 }: { category: StoreCategory; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[category] ?? PATHS.other} />
    </svg>
  );
}

export function StoreIcon({ category, tone, size = 64, round }: { category: StoreCategory; tone: string; size?: number; round?: boolean }) {
  const bg = HEX_RE.test(tone) ? tone : LEGACY_TONES[tone] ?? PRESET_TONES[0];
  return (
    <span
      className="store-icon"
      style={{ width: size, height: size, background: bg, color: inkOn(bg), borderRadius: round ? '50%' : Math.round(size * 0.3) }}
      aria-hidden="true"
    >
      <CategoryGlyph category={category} size={Math.round(size * 0.52)} />
    </span>
  );
}

/** 가게 색을 옅게 (답변 상자 · 가게 머리 배경) */
export function toneSoft(tone: string, alpha = 0.16): string {
  const hex = HEX_RE.test(tone) ? tone : LEGACY_TONES[tone] ?? PRESET_TONES[0];
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
