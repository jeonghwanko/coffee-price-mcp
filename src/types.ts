// coffee.pryzm.gg 공개 API 응답 타입 — apps/benefits/src/lib/types.ts 미러.
// /today 응답은 slim shape 이라 benefitType/conditions 등이 없을 수 있어 모두 optional 로 둔다.

export type BenefitType =
  | 'coupon'
  | 'discount'
  | 'freebie'
  | 'membership'
  | 'payment_discount'
  | 'stamp_reward'
  | 'giveaway'
  | 'participation';

export type DiscountProvider =
  | 'telecom_skt'
  | 'telecom_kt'
  | 'telecom_lgu'
  | 'card_samsung'
  | 'card_hyundai'
  | 'card_shinhan'
  | 'card_kb'
  | 'card_lotte'
  | 'card_bc'
  | 'card_woori'
  | 'card_hana';

/** /coffeecong/brand-benefits 및 /today 응답 카드 1건 (필드 가용성은 엔드포인트별로 다름) */
export interface Benefit {
  id: string;
  brand: string;
  brandLabel: string;
  title: string;
  summary?: string | null;
  benefitType?: BenefitType;
  startDate?: string | null;
  endDate?: string | null;
  sourceUrl: string;
  sourceName?: string;
  discountProvider: DiscountProvider | null;
  discountPct?: number | null;
  recurringDays?: number | null;
  conditions?: string | null;
  status?: string;
}

/** 체감가 계산 결과 */
export interface PriceEstimate {
  /** 체감가 (원). 무료면 0 */
  net: number;
  /** 절약액 = listPrice - net */
  saving: number;
  /** 절약률 (%) */
  savingPct: number;
  /** 산정 신뢰도 */
  confidence: 'high' | 'medium' | 'low';
  /** 산정 근거 (예: '제목 500원 할인', '무료 음료', '20% 할인') */
  basis: string;
}

/** 랭킹된 딜 1건 */
export interface RankedDeal {
  rank: number;
  brand: string;
  brandLabel: string;
  menu: string;
  listPrice: number;
  estimatedPrice: number;
  saving: number;
  savingPct: number;
  confidence: PriceEstimate['confidence'];
  basis: string;
  benefitType?: BenefitType;
  provider: string | null;
  howToUse: string[];
  dday: string;
  title: string;
  sourceUrl: string;
}
