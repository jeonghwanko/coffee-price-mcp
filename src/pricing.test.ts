import { describe, it, expect } from 'vitest';
import {
  parsePercentFromText,
  parseAmountFromText,
  parseBogo,
  parseAbsoluteDrinkPrice,
  wonToNumber,
  detectFreeDrink,
  estimateNetPrice,
  canonicalMenu,
  benefitMenus,
  appliesToMenu,
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
  it('parses 한글 수사 (1천원 할인)', () => {
    expect(parseAmountFromText('1천원 할인')).toBe(1000);
    expect(parseAmountFromText('5백원 쿠폰')).toBe(500);
  });
});

describe('wonToNumber', () => {
  it('parses arabic and korean numerals', () => {
    expect(wonToNumber('1,000')).toBe(1000);
    expect(wonToNumber('1천')).toBe(1000);
    expect(wonToNumber('천')).toBe(1000);
    expect(wonToNumber('5백')).toBe(500);
    expect(wonToNumber('1만')).toBe(10000);
    expect(wonToNumber('1만5천')).toBe(15000);
  });
});

describe('parseAbsoluteDrinkPrice', () => {
  const LIST = 1500;
  it('catches 음료 + 절대 최종가', () => {
    expect(parseAbsoluteDrinkPrice('첫 결제 시 아메리카노 100원', LIST)).toBe(100);
    expect(parseAbsoluteDrinkPrice('기념 아메리카노 1천원', LIST)).toBe(1000);
  });
  it('does NOT fire on 할인/적립/상품권', () => {
    expect(parseAbsoluteDrinkPrice('아메리카노 500원 할인', LIST)).toBeNull();
    expect(parseAbsoluteDrinkPrice('음료 1만원 이상 결제 시', LIST)).toBeNull();
    expect(parseAbsoluteDrinkPrice('커피 상품권 5천원권 증정', LIST)).toBeNull();
  });
  it('rejects price >= 정가 and goods-only', () => {
    expect(parseAbsoluteDrinkPrice('아메리카노 4500원', 4500)).toBeNull();
    expect(parseAbsoluteDrinkPrice('원두 5천원', LIST)).toBeNull();
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

  it('8) absolute final price (첫 결제 100원) → net 100, low', () => {
    const e = estimateNetPrice(benefit({ brand: 'compose', title: '카카오페이 첫 결제 시 아메리카노 100원' }), 1500)!;
    expect(e.net).toBe(100);
    expect(e.confidence).toBe('low');
    expect(e.basis).toBe('최종가 100원');
  });

  it('8b) absolute final price 한글 (아메리카노 1천원) → 1000', () => {
    const e = estimateNetPrice(benefit({ brand: 'compose', title: '고객 만족도 1위 기념 아메리카노 1천원' }), 1500)!;
    expect(e.net).toBe(1000);
  });
});

describe('menu matching', () => {
  it('canonicalMenu normalizes latte variants', () => {
    expect(canonicalMenu('카페라떼')).toBe('라떼');
    expect(canonicalMenu('라테')).toBe('라떼');
    expect(canonicalMenu('아메리카노')).toBe('아메리카노');
    expect(canonicalMenu(undefined)).toBe('아메리카노');
  });
  it('benefitMenus detects targeted core menu, null if agnostic', () => {
    expect(benefitMenus('아메리카노 500원 할인')).toEqual(new Set(['아메리카노']));
    expect(benefitMenus('카페라떼 1+1')).toEqual(new Set(['라떼']));
    expect(benefitMenus('전 음료 20% 할인')).toBeNull();
  });
  it('appliesToMenu gates menu-specific, passes agnostic', () => {
    expect(appliesToMenu('아메리카노 500원 할인', '라떼')).toBe(false);
    expect(appliesToMenu('아메리카노 500원 할인', '아메리카노')).toBe(true);
    expect(appliesToMenu('전 음료 20% 할인', '라떼')).toBe(true);
  });
});
