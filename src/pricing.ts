// 체감가 계산 엔진.
//
// 실데이터 관찰: list 148건 중 discountPct 설정된 건 0개 → 할인 정보는 거의 전부 제목 텍스트에 있다.
// 따라서 제목/요약/조건 텍스트 파싱이 1차 경로다.
//   "아메리카노 500원 할인"      → 정액
//   "아메리카노(T) 1잔 무료"      → 무료 음료 (net 0)
//   "더블 사이즈업 무료"          → 무료 음료 아님 (사이즈업)
//   "현대M포인트 최대 20% 사용"   → 퍼센트
//   "커피 2잔 + 휘낭시에 무료" / discountPct=100 → net 0
//   "1+1" / "2+1"                 → BOGO 환산

import type { Benefit, PriceEstimate } from './types.js';

// 금액 토큰: 아라비아(1,000) + 한글 수사(1천·천·5백·1만5천)
const WON =
  '([0-9][0-9,]*|(?:[1-9]\\s*)?만(?:\\s*[1-9]?\\s*천)?(?:\\s*[1-9]?\\s*백)?|(?:[1-9]\\s*)?천(?:\\s*[1-9]?\\s*백)?|[1-9]?\\s*백)';
// 절대 최종가 판정엔 모호한 '커피/한잔' 제외 — 원두커피 등 오탐 방지
const DRINK_STRICT = '아메리카노|라떼|라테|블렌디드|프라푸치노|음료';
// 'N원' 뒤에 오면 최종가가 아님 (할인/적립/상품권/조건 등)
const ABS_EXCLUDE = '할인|쿠폰|증정|캐시백|페이백|적립|이상|권|상당';

/** 금액 문자열 → 숫자. '1,000'→1000, '1천'→1000, '천'→1000, '5백'→500, '1만'→10000. */
export function wonToNumber(raw: string): number | null {
  const s = raw.replace(/[\s,]/g, '');
  if (/^[0-9]+$/.test(s)) return Number(s);
  let total = 0;
  const man = s.match(/([1-9]?)만/);
  if (man) total += (man[1] ? Number(man[1]) : 1) * 10000;
  const cheon = s.match(/([1-9]?)천/);
  if (cheon) total += (cheon[1] ? Number(cheon[1]) : 1) * 1000;
  const baek = s.match(/([1-9]?)백/);
  if (baek) total += (baek[1] ? Number(baek[1]) : 1) * 100;
  return total > 0 ? total : null;
}

/** "20%" → 20 (0<pct<=100 만 인정). 여러 개면 가장 큰 값. */
export function parsePercentFromText(text: string): number | null {
  const matches = [...text.matchAll(/([0-9]{1,3})\s*%/g)];
  let best: number | null = null;
  for (const m of matches) {
    const v = Number(m[1]);
    if (v > 0 && v <= 100 && (best == null || v > best)) best = v;
  }
  return best;
}

/**
 * "500원 할인" / "1,000원 쿠폰" → 500 / 1000. 즉시 차감 키워드 동반 시만.
 * '적립'(이연 포인트)은 즉시 체감가가 아니므로 제외 — 과대평가 방지.
 */
export function parseAmountFromText(text: string): number | null {
  const re = new RegExp(`${WON}\\s*원\\s*(?:할인|쿠폰|증정|캐시백|페이백)`, 'g');
  let best: number | null = null;
  for (const m of text.matchAll(re)) {
    const v = wonToNumber(m[1]);
    if (v != null && v > 0 && (best == null || v > best)) best = v;
  }
  return best;
}

/**
 * 음료 + "N원" 절대 최종가 ("아메리카노 100원", "라떼 1천원").
 * 할인/적립/상품권 키워드가 뒤따르면 제외(= 할인·적립이지 최종가 아님).
 * 정가 미만 + 50원 이상만 인정. 여러 개면 최저가.
 */
export function parseAbsoluteDrinkPrice(text: string, listPrice: number): number | null {
  const re = new RegExp(
    `(?:${DRINK_STRICT})[^\\n]{0,8}?${WON}\\s*원(?!\\s*(?:${ABS_EXCLUDE}))`,
    'g',
  );
  let best: number | null = null;
  for (const m of text.matchAll(re)) {
    const v = wonToNumber(m[1]);
    if (v == null || v < 50 || v >= listPrice) continue;
    if (best == null || v < best) best = v;
  }
  return best;
}

/** "1+1" / "2+1" → { buy, free }. 음료당 환산용. */
export function parseBogo(text: string): { buy: number; free: number } | null {
  const m = text.match(/(\d{1,2})\s*\+\s*(\d{1,2})/);
  if (!m) return null;
  const buy = Number(m[1]);
  const free = Number(m[2]);
  if (buy >= 1 && free >= 1) return { buy, free };
  return null;
}

const DRINK = '아메리카노|라떼|라테|음료|커피|한\\s*잔|\\d\\s*잔|블렌디드|프라푸치노';
// 음료 단어와 '무료/증정'이 8자 이내로 인접해야 무료 음료로 인정 (마케팅 문구 오탐 방지).
const NEAR_FREE = new RegExp(
  `(?:${DRINK})[^\n]{0,8}(?:무료|증정)|(?:무료|증정)[^\n]{0,8}(?:${DRINK})`,
);

/** 무료 음료 여부 — 음료 단어 인접 '무료/증정'. '사이즈업만 무료'는 제외. */
export function detectFreeDrink(text: string): boolean {
  if (!NEAR_FREE.test(text)) return false;
  // "사이즈업 무료"만 있고 음료 잔 무료 언급이 없으면 무료 음료 아님
  const onlySizeUp =
    /사이즈\s*업/.test(text) &&
    !new RegExp(`(?:한\\s*잔|\\d\\s*잔|아메리카노|음료)[^\n]{0,8}무료|무료[^\n]{0,8}(?:음료|커피|아메리카노)`).test(
      text,
    );
  return !onlySizeUp;
}

function pct(net: number, list: number): { saving: number; savingPct: number } {
  const saving = Math.max(0, Math.round(list - net));
  return { saving, savingPct: list > 0 ? Math.round((saving / list) * 100) : 0 };
}

/**
 * 체감가 산정. 불가하면 null (랭킹에서 제외).
 * @param benefit  혜택
 * @param listPrice 브랜드 메뉴 정가
 */
export function estimateNetPrice(benefit: Benefit, listPrice: number): PriceEstimate | null {
  // 제목 + 조건(conditions)만 파싱한다. 요약(summary)은 마케팅 문구라 '무료/할인' 오탐이 잦다.
  const text = [benefit.title, benefit.conditions].filter(Boolean).join(' ');

  // 1) 명시적 discountPct (드물지만 신뢰도 최상)
  if (benefit.discountPct != null && benefit.discountPct > 0) {
    const net = Math.max(0, Math.round(listPrice * (1 - benefit.discountPct / 100)));
    return { net, ...pct(net, listPrice), confidence: 'high', basis: `${benefit.discountPct}% 할인` };
  }

  // 2) 무료 음료 (음료 단어 인접 '무료')
  if (detectFreeDrink(text)) {
    return { net: 0, ...pct(0, listPrice), confidence: 'medium', basis: '무료 음료' };
  }

  // 음료가 아니라 원두/굿즈/베이커리 등에만 적용되는 할인은 음료 체감가에서 제외.
  // 할인 '대상'은 제목에 있으므로 제목 기준으로 판정. '커피 클래스'는 음료가 아닌 활동이라 제외.
  const guardTitle = benefit.title.replace(/커피\s*클래스|클래스/g, '');
  const goodsOnly =
    /(원두|머신|텀블러|굿즈|MD\s*상품|베이커리|케이크|기프트|상품권)/i.test(guardTitle) &&
    !new RegExp(DRINK).test(guardTitle);

  // 3) 퍼센트 (제목)
  const p = goodsOnly ? null : parsePercentFromText(text);
  if (p != null) {
    const net = Math.max(0, Math.round(listPrice * (1 - p / 100)));
    return { net, ...pct(net, listPrice), confidence: 'medium', basis: `${p}% 할인` };
  }

  // 4) BOGO (1+1, 2+1) → 음료당 환산
  const bogo = parseBogo(text);
  if (bogo) {
    const net = Math.round((listPrice * bogo.buy) / (bogo.buy + bogo.free));
    return {
      net,
      ...pct(net, listPrice),
      confidence: 'medium',
      basis: `${bogo.buy}+${bogo.free} 환산`,
    };
  }

  // 5) 정액 할인 (제목)
  const amt = goodsOnly ? null : parseAmountFromText(text);
  if (amt != null) {
    const net = Math.max(0, listPrice - amt);
    return { net, ...pct(net, listPrice), confidence: 'medium', basis: `${amt}원 할인` };
  }

  // 6) 절대 최종가 ("아메리카노 100원", "라떼 1천원") — 음료 자체 판매가. 조건부 프로모 많아 low.
  const abs = goodsOnly ? null : parseAbsoluteDrinkPrice(text, listPrice);
  if (abs != null) {
    return { net: abs, ...pct(abs, listPrice), confidence: 'low', basis: `최종가 ${abs}원` };
  }

  // 7) 산정 불가
  return null;
}
