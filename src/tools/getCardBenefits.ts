import { z } from 'zod';
import { fetchAllBenefits } from '../apiClient.js';
import { estimateNetPrice } from '../pricing.js';
import { getListPrice } from '../menuPrices.js';
import {
  providerLabel,
  ISSUERS,
  detectIssuers,
  matchIssuerKey,
  issuerLabel,
} from '../providers.js';
import type { Benefit } from '../types.js';

const BENEFIT_TYPE_LABEL: Record<string, string> = {
  coupon: '쿠폰',
  discount: '할인',
  freebie: '무료증정',
  membership: '멤버십',
  payment_discount: '결제 할인/적립',
  stamp_reward: '스탬프 적립',
  giveaway: '경품',
  participation: '참여 이벤트',
};

export const getCardBenefitsInput = {
  card: z
    .string()
    .optional()
    .describe('카드사/통신사/페이명 (예: 신한, 현대카드, KT, 하나페이). 미지정 시 전체 발급사별로 묶음.'),
  brand: z.string().optional().describe('브랜드 slug 필터 (예: mega)'),
  limit: z.number().int().min(1).max(30).optional().describe('발급사당 최대 혜택 수 (기본 12)'),
};

export async function getCardBenefitsHandler(args: {
  card?: string;
  brand?: string;
  limit?: number;
}) {
  const items: Benefit[] = await fetchAllBenefits(args.brand);
  const wantKey = args.card ? matchIssuerKey(args.card) : null;
  const perIssuer = args.limit ?? 12;

  // key → 혜택 배열
  const groups = new Map<string, ReturnType<typeof toDeal>[]>();

  for (const b of items) {
    if (args.brand && b.brand !== args.brand) continue;
    const text = [b.title, b.summary, b.conditions, providerLabel(b.discountProvider)]
      .filter(Boolean)
      .join(' ');
    const issuers = detectIssuers(text);
    if (issuers.length === 0) continue;

    for (const key of issuers) {
      if (wantKey && key !== wantKey) continue;
      const arr = groups.get(key) ?? [];
      arr.push(toDeal(b));
      groups.set(key, arr);
    }
  }

  // ISSUERS 순서대로 정렬, 그룹 내부는 체감가 산정된 것 우선 → 체감가 오름차순
  const cards = ISSUERS.filter((i) => groups.has(i.key)).map((i) => {
    const deals = (groups.get(i.key) ?? []).sort((a, b) => {
      const ap = a.estimatedPrice ?? Number.POSITIVE_INFINITY;
      const bp = b.estimatedPrice ?? Number.POSITIVE_INFINITY;
      return ap - bp;
    });
    return {
      issuer: i.key,
      label: issuerLabel(i.key),
      dealCount: deals.length,
      deals: deals.slice(0, perIssuer),
    };
  });

  const total = cards.reduce((s, c) => s + c.dealCount, 0);
  const payload = {
    issuerCount: cards.length,
    totalDeals: total,
    note: '체감가(estimatedPrice)가 null이면 캐시백·적립·조건부 등 즉시 할인 환산 불가 — 원문(sourceUrl)에서 확인하세요.',
    cards,
  };
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}

function toDeal(b: Benefit) {
  const listPrice = getListPrice(b.brand);
  const est = listPrice != null ? estimateNetPrice(b, listPrice) : null;
  return {
    brand: b.brand,
    brandLabel: b.brandLabel,
    title: b.title,
    benefitType: b.benefitType ? BENEFIT_TYPE_LABEL[b.benefitType] ?? b.benefitType : null,
    estimatedPrice: est?.net ?? null,
    listPrice: listPrice ?? null,
    basis: est?.basis ?? '체감가 산정 불가 — 원문 확인',
    endDate: b.endDate ?? null,
    sourceUrl: b.sourceUrl,
  };
}
