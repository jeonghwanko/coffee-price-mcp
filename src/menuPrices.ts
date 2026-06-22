// 브랜드별 메뉴 정가 (원) — DB 에 정가가 없어 코드 상수로 시작 (플랜 결정).
// 출처: 2026년 각 브랜드 공식 가격 기준 근사값. 웹 구축 시 packages/shared 로 승격 예정.
// API brand 키(소문자 slug)와 1:1 매핑.

export const DEFAULT_MENU = '아메리카노';

// 서버 SSOT: apps/api/data/coffeecong-menu-prices.json 와 동기 유지 (서버 미배포 시 폴백용).
/** brand slug → (menu → 정가) */
export const MENU_PRICES: Record<string, Record<string, number>> = {
  starbucks: { 아메리카노: 4500, 라떼: 5000 },
  mega: { 아메리카노: 1500, 라떼: 3200 },
  compose: { 아메리카노: 1500, 라떼: 3000 },
  twosome: { 아메리카노: 4500, 라떼: 5000 },
  coffeebean: { 아메리카노: 4800, 라떼: 5300 },
  bluebottle: { 아메리카노: 6100, 라떼: 6600 },
  hollys: { 아메리카노: 4100, 라떼: 4600 },
  ediya: { 아메리카노: 3200, 라떼: 3700 },
  paik: { 아메리카노: 1800, 라떼: 3300 },
  theventi: { 아메리카노: 1800, 라떼: 3000 },
  gongcha: { 아메리카노: 3500, 라떼: 4300 },
};

/** 정가 조회 — 메뉴 미존재 시 해당 브랜드 아메리카노, 브랜드 미존재 시 null */
export function getListPrice(brand: string, menu: string = DEFAULT_MENU): number | null {
  const byMenu = MENU_PRICES[brand];
  if (!byMenu) return null;
  return byMenu[menu] ?? byMenu[DEFAULT_MENU] ?? null;
}

/** 정가 데이터가 있는 브랜드 목록 */
export function knownBrands(): string[] {
  return Object.keys(MENU_PRICES);
}
