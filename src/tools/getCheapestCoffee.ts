import { z } from 'zod';
import { getRankedDeals } from '../engine.js';
import { knownBrands } from '../menuPrices.js';

export const getCheapestCoffeeInput = {
  memberships: z
    .array(z.string())
    .optional()
    .describe('보유 멤버십/카드 (예: ["SKT","현대카드"]). 지정 시 보유하지 않은 제휴 혜택은 제외.'),
  menu: z.string().optional().describe('메뉴명 (기본: 아메리카노)'),
  brands: z
    .array(z.string())
    .optional()
    .describe(`브랜드 slug 필터 (예: ["starbucks","mega"]). 가능: ${knownBrands().join(', ')}`),
  limit: z.number().int().min(1).max(30).optional().describe('반환 개수 (기본 10)'),
};

export async function getCheapestCoffeeHandler(args: {
  memberships?: string[];
  menu?: string;
  brands?: string[];
  limit?: number;
}) {
  const deals = await getRankedDeals(args);
  const payload = {
    menu: args.menu ?? '아메리카노',
    memberships: args.memberships ?? [],
    count: deals.length,
    deals,
    note: '체감가는 정가(코드 상수) − 혜택(제목 파싱) 추정치입니다. 실제 조건은 sourceUrl 확인.',
  };
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}
