import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Benefit } from '../types.js';

const { mockFetchAll, mockFetchToday } = vi.hoisted(() => ({
  mockFetchAll: vi.fn(),
  mockFetchToday: vi.fn(),
}));
vi.mock('../apiClient.js', () => ({
  fetchAllBenefits: mockFetchAll,
  fetchTodayBenefits: mockFetchToday,
}));

import { searchCoffeeDealsHandler } from './searchCoffeeDeals.js';

function b(p: Partial<Benefit>): Benefit {
  return {
    id: p.id ?? 'x',
    brand: p.brand ?? 'twosome',
    brandLabel: p.brandLabel ?? '투썸',
    title: p.title ?? '',
    sourceUrl: 'https://e',
    discountProvider: p.discountProvider ?? null,
    ...p,
  };
}

const ROWS: Benefit[] = [
  b({ id: '1', title: '신한 나라사랑카드 캐시백 프로모션', benefitType: 'payment_discount' }),
  b({ id: '2', brand: 'mega', title: '6월 메가MGC커피 X 하나페이 할인 EVENT', benefitType: 'payment_discount' }),
  b({ id: '3', brand: 'mega', title: '아메리카노 500원 할인', benefitType: 'discount' }),
];

async function search(args: Parameters<typeof searchCoffeeDealsHandler>[0]) {
  const res = await searchCoffeeDealsHandler(args);
  return JSON.parse(res.content[0].text) as { deals: Array<{ title: string }> };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchAll.mockResolvedValue(ROWS);
  mockFetchToday.mockResolvedValue(ROWS);
});

describe('searchCoffeeDeals — provider 텍스트 감지 필터', () => {
  it('provider=신한 → discountProvider가 null이어도 제목 텍스트로 매칭', async () => {
    const { deals } = await search({ provider: '신한' });
    expect(deals.map((d) => d.title)).toEqual(['신한 나라사랑카드 캐시백 프로모션']);
  });

  it('provider=하나페이 → 하나 발급사 혜택 매칭', async () => {
    const { deals } = await search({ provider: '하나페이' });
    expect(deals).toHaveLength(1);
    expect(deals[0].title).toContain('하나페이');
  });

  it('provider 미지정이면 전체 반환', async () => {
    const { deals } = await search({});
    expect(deals).toHaveLength(3);
  });

  it('해석 불가한 provider는 부분일치 폴백', async () => {
    const { deals } = await search({ provider: '나라사랑' });
    expect(deals).toHaveLength(1);
  });
});
