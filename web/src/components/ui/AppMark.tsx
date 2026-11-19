/** 앱 아이콘 (public/favicon.svg와 같은 모양) */
export function AppMark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="24" fill="#3ccfae" />
      <circle cx="47" cy="46" r="22" fill="none" stroke="#15201d" strokeWidth="10" />
      <path d="M68.8 56.1 L77 77 L57.1 67.8 Z" fill="#15201d" stroke="#15201d" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}
