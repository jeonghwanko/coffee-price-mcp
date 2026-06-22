// 통신사/카드사 제공자 메타 — apps/benefits/src/constants/providers.js 포팅.
import type { DiscountProvider } from './types.js';

export const PROVIDER_META: Record<DiscountProvider, { label: string }> = {
  telecom_skt: { label: 'SKT T멤버십' },
  telecom_kt: { label: 'KT 멤버십' },
  telecom_lgu: { label: 'LG U+ 멤버십' },
  card_samsung: { label: '삼성카드' },
  card_hyundai: { label: '현대카드' },
  card_shinhan: { label: '신한카드' },
  card_kb: { label: 'KB카드' },
  card_lotte: { label: '롯데카드' },
  card_bc: { label: 'BC카드' },
  card_woori: { label: '우리카드' },
  card_hana: { label: '하나카드' },
};

export function providerLabel(p: DiscountProvider | null): string | null {
  return p ? PROVIDER_META[p]?.label ?? p : null;
}

// 사용자가 자유 텍스트로 멤버십을 줄 수 있어 friendly 토큰 → provider id 매핑.
const ALIASES: Array<[RegExp, DiscountProvider]> = [
  [/\b(skt|sk텔레콤|sk telecom|t ?멤버십|티멤버십)\b/i, 'telecom_skt'],
  [/\b(kt|케이티|올레)\b/i, 'telecom_kt'],
  [/\b(lg ?u\+?|lgu\+?|유플러스|유플|lg유플러스)\b/i, 'telecom_lgu'],
  [/삼성/i, 'card_samsung'],
  [/현대/i, 'card_hyundai'],
  [/신한/i, 'card_shinhan'],
  [/\b(kb|국민)\b/i, 'card_kb'],
  [/롯데/i, 'card_lotte'],
  [/\bbc\b|비씨/i, 'card_bc'],
  [/우리/i, 'card_woori'],
  [/하나/i, 'card_hana'],
];

/** 자유 텍스트 멤버십 1개 → provider id (못 찾으면 이미 id 형식이면 그대로, 아니면 null) */
export function normalizeMembership(input: string): DiscountProvider | null {
  const s = input.trim();
  if (s in PROVIDER_META) return s as DiscountProvider;
  for (const [re, id] of ALIASES) {
    if (re.test(s)) return id;
  }
  return null;
}

/** 멤버십 입력 배열 → provider id Set */
export function normalizeMemberships(inputs: string[] | undefined): Set<DiscountProvider> {
  const set = new Set<DiscountProvider>();
  for (const raw of inputs ?? []) {
    const id = normalizeMembership(raw);
    if (id) set.add(id);
  }
  return set;
}

// ── 카드사/통신사/페이 발급사 감지 (정보성 "카드사별 혜택 보기"용) ──────────────
// 혜택의 discountProvider 필드는 대부분 null이고 발급사는 제목 텍스트에만 있다.
// 캐시백·적립처럼 체감가가 안 잡히는 혜택도 발급사별로 묶어 보여주기 위해 텍스트로 감지한다.

export interface Issuer {
  /** 그룹 키 (사용자 필터·표시용) */
  key: string;
  /** 표시 라벨 */
  label: string;
  /** 제목/요약에서 이 발급사를 감지하는 정규식 */
  re: RegExp;
}

export const ISSUERS: Issuer[] = [
  { key: 'KT', label: 'KT 멤버십', re: /\bKT\b|케이티|올레/i },
  { key: 'SKT', label: 'SKT T멤버십', re: /\bSKT\b|T ?멤버십|티멤버십|SK ?텔레콤|우주패스/i },
  { key: 'LGU', label: 'LG U+ 멤버십', re: /LG ?U\+?|유플러스|U\+/i },
  { key: '현대카드', label: '현대카드', re: /현대카드|현대 ?M ?포인트|현대M/i },
  { key: '신한', label: '신한카드·신한SOL페이', re: /신한/ },
  { key: '삼성카드', label: '삼성카드', re: /삼성카드|삼성페이/ },
  { key: 'KB국민', label: 'KB국민카드·KB페이', re: /국민카드|KB ?카드|KB ?페이|KB ?국민/i },
  { key: '롯데카드', label: '롯데카드', re: /롯데카드/ },
  { key: 'BC카드', label: 'BC카드', re: /\bBC ?카드|비씨카드/i },
  { key: '우리카드', label: '우리카드', re: /우리카드/ },
  { key: '하나', label: '하나카드·하나페이', re: /하나카드|하나페이|하나 ?원큐/i },
  { key: '카카오페이', label: '카카오페이', re: /카카오페이/ },
  { key: '네이버페이', label: '네이버페이', re: /네이버페이/ },
  { key: 'PAYCO', label: 'PAYCO', re: /payco|페이코/i },
  { key: '토스', label: '토스', re: /토스페이|토스 ?결제/i },
];

/** 텍스트에서 감지되는 모든 발급사 key 배열 */
export function detectIssuers(text: string): string[] {
  return ISSUERS.filter((i) => i.re.test(text)).map((i) => i.key);
}

/** 사용자 입력 카드/통신사명 → 발급사 key (없으면 null) */
export function matchIssuerKey(input: string): string | null {
  const s = input.trim();
  const hit = ISSUERS.find((i) => i.key.toLowerCase() === s.toLowerCase() || i.re.test(s));
  return hit ? hit.key : null;
}

/** key → 라벨 */
export function issuerLabel(key: string): string {
  return ISSUERS.find((i) => i.key === key)?.label ?? key;
}
