export type StoreStatus = 'pending' | 'active' | 'deleted' | 'suspended';
export type StoreCategory =
  | 'cafe' | 'restaurant' | 'bar' | 'bakery' | 'pc' | 'beauty' | 'shop' | 'person'
  | 'other' | 'flower' | 'fitness' | 'study' | 'karaoke' | 'pet' | 'stay' | 'car';
/** 색 코드 #rrggbb */
export type StoreTone = string;

export interface Store {
  code: string;
  storeName: string;
  intro: string;
  category: StoreCategory;
  tone: StoreTone;
  ownerUid: string;
  lang: string;
  status: StoreStatus;
  acceptingQuestions: boolean;
  blockedWords: string[];
  createdAt: Date | null;
}

export interface Answer {
  body: string;
  at: Date | null;
  editedAt: Date | null;
}

export type HiddenBy = null | 'owner' | 'report' | 'admin';
export type QuestionKind = 'question' | 'suggestion' | 'complaint' | 'praise';
export const QUESTION_KINDS: QuestionKind[] = ['question', 'suggestion', 'complaint', 'praise'];
/** public: 모두에게 공개(답변 후) · owner: 사장님만 */
export type Visibility = 'public' | 'owner';

export interface Question {
  id: string;
  body: string;
  lang: string;
  kind: QuestionKind;
  visibility: Visibility;
  status: 'open' | 'answered';
  answer: Answer | null;
  hidden: boolean;
  hiddenBy: HiddenBy;
  reportCount: number;
  pinned: boolean;
  createdAt: Date | null;
}

export type ReportReason = 'abuse' | 'privacy' | 'spam' | 'sexual' | 'defamation' | 'other';
export const REPORT_REASONS: ReportReason[] = ['abuse', 'privacy', 'spam', 'sexual', 'defamation', 'other'];

/** 약관 버전. 바뀌면 다음 로그인 때 다시 동의를 받는다. */
export const TERMS_VERSION = '2026-11-19';
