import { describe, it, expect } from 'vitest';
import { detectIssuers, matchIssuerKey, issuerLabel } from './providers.js';

describe('detectIssuers', () => {
  it('제목 텍스트에서 발급사 감지', () => {
    expect(detectIssuers('신한 나라사랑카드 캐시백 프로모션')).toContain('신한');
    expect(detectIssuers('[제휴] 메가MGC커피 X 현대카드 현대M포인트 20%')).toContain('현대카드');
    expect(detectIssuers('6월 메가MGC커피 X 하나페이 할인 EVENT')).toContain('하나');
    expect(detectIssuers('KT 멤버십 VVIP 초이스 할리스 혜택')).toContain('KT');
  });
  it('여러 발급사 동시 감지', () => {
    const r = detectIssuers('카카오페이 첫 결제 + 신한카드 추가 할인');
    expect(r).toEqual(expect.arrayContaining(['카카오페이', '신한']));
  });
  it('발급사 언급 없으면 빈 배열', () => {
    expect(detectIssuers('아메리카노 500원 할인 프로모션')).toEqual([]);
  });
});

describe('matchIssuerKey', () => {
  it('사용자 입력 → 발급사 key', () => {
    expect(matchIssuerKey('현대카드')).toBe('현대카드');
    expect(matchIssuerKey('신한')).toBe('신한');
    expect(matchIssuerKey('하나페이')).toBe('하나');
    expect(matchIssuerKey('KT')).toBe('KT');
  });
  it('매칭 안 되면 null', () => {
    expect(matchIssuerKey('없는카드사')).toBeNull();
  });
});

describe('issuerLabel', () => {
  it('key → 라벨', () => {
    expect(issuerLabel('하나')).toBe('하나카드·하나페이');
    expect(issuerLabel('KT')).toBe('KT 멤버십');
  });
});
