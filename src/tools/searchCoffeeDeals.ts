import { z } from 'zod';
import { fetchAllBenefits, fetchTodayBenefits } from '../apiClient.js';
import { estimateNetPrice } from '../pricing.js';
import { getListPrice } from '../menuPrices.js';
import { providerLabel, normalizeMembership } from '../providers.js';
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
    .describe('통신사/카드사 (예: SKT, 현대카드) — 해당 제휴 혜택만'),
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

  const wantProvider = args.provider ? normalizeMembership(args.provider) : null;
  const q = args.query?.trim().toLowerCase();

  const filtered = items.filter((b) => {
    if (args.brand && b.brand !== args.brand) return false;
    if (wantProvider && b.discountProvider !== wantProvider) return false;
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
