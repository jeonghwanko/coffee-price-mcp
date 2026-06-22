import { describe, it, expect } from 'vitest';
import { mergeBenefits } from './engine.js';
import type { Benefit } from './types.js';

function b(partial: Partial<Benefit> & { id: string }): Benefit {
  return {
    brand: 'mega',
    brandLabel: '메가커피',
    title: '',
    sourceUrl: 'https://e',
    discountProvider: null,
    ...partial,
  };
}

describe('mergeBenefits', () => {
  it('today 의 discountPct 가 full list 의 null 을 보강한다 (clobber 회귀 방지)', () => {
    const list = [b({ id: '1', title: '풀', benefitType: 'discount', discountPct: null })];
    const today = [b({ id: '1', title: '투데이', discountPct: 100 })];
    const merged = mergeBenefits(list, today);
    expect(merged).toHaveLength(1);
    expect(merged[0].discountPct).toBe(100); // today 값으로 보강
    expect(merged[0].benefitType).toBe('discount'); // full 의 값은 유지
  });

  it('full 에 값이 있으면 today 가 덮지 않는다', () => {
    const list = [b({ id: '1', title: '풀 제목', discountProvider: 'card_kb' })];
    const today = [b({ id: '1', title: '투데이 제목', discountProvider: 'telecom_kt' })];
    const merged = mergeBenefits(list, today);
    expect(merged[0].title).toBe('풀 제목');
    expect(merged[0].discountProvider).toBe('card_kb');
  });

  it('today 전용 항목은 그대로 추가된다', () => {
    const merged = mergeBenefits([b({ id: '1' })], [b({ id: '2', discountPct: 50 })]);
    expect(merged.map((m) => m.id).sort()).toEqual(['1', '2']);
  });
});
