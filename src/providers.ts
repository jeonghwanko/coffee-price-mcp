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
