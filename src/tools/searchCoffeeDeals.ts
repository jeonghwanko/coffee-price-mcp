import { z } from 'zod';
import { fetchAllBenefits, fetchTodayBenefits } from '../apiClient.js';
import { estimateNetPrice } from '../pricing.js';
import { getListPrice } from '../menuPrices.js';
import {
  providerLabel,
  normalizeMembership,
  matchIssuerKey,
  detectIssuers,
} from '../providers.js';
import type { Benefit } from '../types.js';

const BENEFIT_TYPES = [
  'coupon',
  'discount',
  'freebie',
  'membership',
  'payment_discount',
  'stamp_reward',
  'giveaway',
  'participation',
] as const;

export const searchCoffeeDealsInput = {
  query: z.string().optional().describe('제목/요약 텍스트 검색어'),
  brand: z.string().optional().describe('브랜드 slug (예: starbucks)'),
  provider: z
    .string()
    .optional()
    .describe('통신사/카드사/페이 (예: 신한, 현대카드, KT, 하나페이) — 제목 텍스트로 발급사를 감지해 해당 혜택만. 캐시백·적립도 포함.'),
  benefitType: z.enum(BENEFIT_TYPES).optional().describe('혜택 유형'),
  todayOnly: z.boolean().optional().describe('true면 오늘 받을 수 있는 통신사·카드사 할인만'),
  limit: z.number().int().min(1).max(50).optional().describe('반환 개수 (기본 20)'),
};

export async function searchCoffeeDealsHandler(args: {
  query?: string;
  brand?: string;
  provider?: string;
  benefitType?: (typeof BENEFIT_TYPES)[number];
  todayOnly?: boolean;
  limit?: number;
}) {
  const items: Benefit[] = args.todayOnly
    ? await fetchTodayBenefits()
    : await fetchAllBenefits(args.brand);

  // provider 필터: discountProvider 필드는 대부분 null이라, 발급사를 제목 텍스트로도 감지한다.
  const wantProvider = args.provider ? normalizeMembership(args.provider) : null; // 구조 필드 매칭(보조)
  const wantIssuer = args.provider ? matchIssuerKey(args.provider) : null; // 텍스트 감지(주)
  const q = args.query?.trim().toLowerCase();

  const filtered = items.filter((b) => {
    if (args.brand && b.brand !== args.brand) return false;
    if (args.provider) {
      const text = `${b.title} ${b.summary ?? ''} ${b.conditions ?? ''} ${providerLabel(b.discountProvider) ?? ''}`;
      const structHit = wantProvider != null && b.discountProvider === wantProvider;
      const textHit = wantIssuer != null && detectIssuers(text).includes(wantIssuer);
      // 알려진 발급사로 해석 안 되면 입력어 그대로 부분일치 폴백
      const rawHit =
        wantProvider == null && wantIssuer == null &&
        text.toLowerCase().includes(args.provider.toLowerCase());
      if (!(structHit || textHit || rawHit)) return false;
    }
    if (args.benefitType && b.benefitType !== args.benefitType) return false;
    if (q) {
      const hay = `${b.title} ${b.summary ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const limit = args.limit ?? 20;
  const deals = filtered.slice(0, limit).map((b) => {
    const listPrice = getListPrice(b.brand);
    const est = listPrice != null ? estimateNetPrice(b, listPrice) : null;
    return {
      brand: b.brand,
      brandLabel: b.brandLabel,
      title: b.title,
      summary: b.summary ?? null,
      benefitType: b.benefitType ?? null,
      provider: providerLabel(b.discountProvider),
      endDate: b.endDate ?? null,
      sourceUrl: b.sourceUrl,
      listPrice,
      estimatedPrice: est?.net ?? null,
      saving: est?.saving ?? null,
      savingPct: est?.savingPct ?? null,
      priceBasis: est?.basis ?? '체감가 산정 불가 — 조건 확인 필요',
    };
  });

  const payload = { count: deals.length, totalMatched: filtered.length, deals };
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}
