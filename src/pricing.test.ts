import { describe, it, expect } from 'vitest';
import {
  parsePercentFromText,
  parseAmountFromText,
  parseBogo,
  detectFreeDrink,
  estimateNetPrice,
} from './pricing.js';
import type { Benefit } from './types.js';

function benefit(partial: Partial<Benefit>): Benefit {
  return {
    id: 'x',
    brand: 'starbucks',
    brandLabel: '스타벅스',
    title: '',
    sourceUrl: 'https://e',
    discountProvider: null,
    ...partial,
  };
}

describe('parseAmountFromText', () => {
  it('parses 원 + 할인', () => {
    expect(parseAmountFromText('메가커피 아메리카노 500원 할인')).toBe(500);
    expect(parseAmountFromText('1,000원 쿠폰 증정')).toBe(1000);
  });
  it('returns null without keyword', () => {
    expect(parseAmountFromText('아메리카노 4500원')).toBeNull();
  });
});

describe('parsePercentFromText', () => {
  it('takes the largest valid percent', () => {
    expect(parsePercentFromText('현대M포인트 최대 20% 사용')).toBe(20);
    expect(parsePercentFromText('10% 또는 15% 할인')).toBe(15);
  });
  it('ignores out-of-range', () => {
    expect(parsePercentFromText('200% 적립')).toBeNull();
    expect(parsePercentFromText('60분 클래스')).toBeNull();
  });
});

describe('parseBogo', () => {
  it('parses 1+1 and 2+1', () => {
    expect(parseBogo('아메리카노 1+1')).toEqual({ buy: 1, free: 1 });
    expect(parseBogo('2 + 1 행사')).toEqual({ buy: 2, free: 1 });
  });
  it('parses adjacent multi-digit (10+2)', () => {
    expect(parseBogo('음료 10+2 행사')).toEqual({ buy: 10, free: 2 });
  });
});

describe('detectFreeDrink', () => {
  it('detects free drink', () => {
    expect(detectFreeDrink('아메리카노(T) 1잔 무료')).toBe(true);
    expect(detectFreeDrink('커피 2잔 + 휘낭시에 무료')).toBe(true);
  });
  it('rejects size-up only', () => {
    expect(detectFreeDrink('더블 사이즈업 무료')).toBe(false);
  });
  it('treats "OR 사이즈업" combined title as free drink', () => {
    expect(detectFreeDrink('아메리카노(T) 1잔 무료 OR 더블 사이즈업 무료')).toBe(true);
  });
});

describe('estimateNetPrice', () => {
  const LIST = 4500;

  it('1) explicit discountPct (high)', () => {
    const e = estimateNetPrice(benefit({ discountPct: 100, title: '세트 무료' }), LIST)!;
    expect(e.net).toBe(0);
    expect(e.confidence).toBe('high');
  });

  it('2) free drink → 0', () => {
    const e = estimateNetPrice(benefit({ title: '아메리카노(T) 1잔 무료' }), LIST)!;
    expect(e.net).toBe(0);
    expect(e.basis).toBe('무료 음료');
  });

  it('3) percent from text', () => {
    const e = estimateNetPrice(benefit({ title: '현대M포인트 최대 20% 사용' }), LIST)!;
    expect(e.net).toBe(3600);
    expect(e.savingPct).toBe(20);
  });

  it('4) bogo 1+1 → half', () => {
    const e = estimateNetPrice(benefit({ title: '아메리카노 1+1' }), LIST)!;
    expect(e.net).toBe(2250);
  });

  it('5) fixed amount', () => {
    const e = estimateNetPrice(benefit({ brand: 'mega', title: '아메리카노 500원 할인' }), 1500)!;
    expect(e.net).toBe(1000);
    expect(e.saving).toBe(500);
  });

  it('6) unparseable → null', () => {
    expect(estimateNetPrice(benefit({ title: '계좌 간편결제 자동 충전 안내' }), LIST)).toBeNull();
  });

  it('7) goods-only discount (원두/MD, no drink) → null', () => {
    expect(estimateNetPrice(benefit({ title: '원두 및 MD 상품 구매 20% 할인' }), 6100)).toBeNull();
  });

  it('7b) percent that DOES mention drink still applies', () => {
    const e = estimateNetPrice(benefit({ title: '아메리카노 포함 음료 20% 할인' }), 4500)!;
    expect(e.net).toBe(3600);
  });
});
