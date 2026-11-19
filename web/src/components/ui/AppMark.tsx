/** 앱 아이콘 (public/favicon.svg와 같은 모양): 말풍선 + 가자(›) */
export function AppMark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="24" fill="#3ccfae" />
      <path d="M30 24h40a12 12 0 0 1 12 12v22a12 12 0 0 1-12 12H44l-14 12v-12a12 12 0 0 1-12-12V36a12 12 0 0 1 12-12Z" fill="#15201d" />
      <path d="M44 37l11 10-11 10" fill="none" stroke="#3ccfae" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
