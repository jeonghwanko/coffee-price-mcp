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
  it('데이터 기반 보강 키워드 (IBK·L.POINT·OK캐쉬백·SOL페이)', () => {
    expect(detectIssuers('메가MGC커피 X IBK나라사랑카드 제휴 혜택')).toContain('IBK');
    expect(detectIssuers('엘포인트 제휴 기념 이벤트')).toContain('L.POINT');
    expect(detectIssuers('OK캐쉬백 제휴 포인트 사용 안내')).toContain('OK캐쉬백');
    expect(detectIssuers('신한 SOL페이 적립 EVENT')).toContain('신한');
  });
  it('우리/하나 등 부분어 오탐 방지 (우리의 디카페인은 우리카드 아님)', () => {
    expect(detectIssuers("'그날 밤, 우리의 디카페인' 키링 SET")).not.toContain('우리카드');
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
