// 랭킹 엔진 — get_cheapest_coffee 와 verify_receipt_price 가 공유.
import { fetchAllBenefits, fetchTodayBenefits, fetchServerCheapest } from './apiClient.js';
import { estimateNetPrice, appliesToMenu, canonicalMenu } from './pricing.js';
import { getListPrice, DEFAULT_MENU } from './menuPrices.js';
import { providerLabel, normalizeMemberships } from './providers.js';
import type { Benefit, RankedDeal } from './types.js';

function computeDday(endIso?: string | null): string {
  if (!endIso) return '상시';
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return '상시';
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const days = Math.round((endDay - today) / 86_400_000);
  if (days < 0) return '마감';
  if (days === 0) return '오늘 마감';
  if (days === 1) return '내일 마감';
  return `D-${days}`;
}

// 영수증 인증 원두 적립이 자연스러운 혜택 유형 (참여/응모/스탬프형은 제외 — 과대주장 방지)
const RECEIPT_ELIGIBLE = new Set(['discount', 'payment_discount', 'coupon', 'freebie', 'membership']);

function buildHowToUse(b: Benefit): string[] {
  const out: string[] = [];
  const pl = providerLabel(b.discountProvider);
  if (pl) out.push(`${pl} 필요`);
  if (b.conditions) out.push(b.conditions);
  if (b.benefitType && RECEIPT_ELIGIBLE.has(b.benefitType)) {
    out.push('커피콩 앱에서 영수증 인증 시 원두 적립 가능');
  }
  return out;
}

/**
 * id 기준 병합. full list(전체, full shape)를 base 로 두고, today(slim) 의 값으로
 * base 의 null/undefined 필드만 보강한다 (today 의 discountPct 등이 손실되지 않도록).
 */
export function mergeBenefits(list: Benefit[], today: Benefit[]): Benefit[] {
  const byId = new Map<string, Benefit>();
  for (const b of list) byId.set(b.id, b);
  for (const b of today) {
    const existing = byId.get(b.id);
    if (!existing) {
      byId.set(b.id, b);
      continue;
    }
    const merged = { ...existing } as Record<string, unknown>;
    for (const [k, v] of Object.entries(b)) {
      if (v != null && merged[k] == null) merged[k] = v;
    }
    byId.set(b.id, merged as unknown as Benefit);
  }
  return [...byId.values()];
}

export interface RankOptions {
  memberships?: string[];
  menu?: string;
  brands?: string[];
  limit?: number;
}

/**
 * 체감가 오름차순 랭킹된 딜 목록.
 * 서버 /cheapest (SSOT) 우선 — 미배포/실패 시 로컬 엔진으로 폴백.
 */
export async function getRankedDeals(opts: RankOptions): Promise<RankedDeal[]> {
  // 친화명("SKT") → provider id("telecom_skt") 정규화 — 서버·로컬 모두 id 로 비교.
  const myProviders = normalizeMemberships(opts.memberships);
  const providerIds = [...myProviders];

  const server = await fetchServerCheapest({
    menu: opts.menu,
    memberships: providerIds,
    brands: opts.brands,
    limit: opts.limit,
  });
  if (server) return server as RankedDeal[];

  // ── 폴백: 로컬 체감가 엔진 (서버 엔드포인트 배포 전) ──
  const menu = canonicalMenu(opts.menu ?? DEFAULT_MENU);
  const brandFilter = opts.brands?.length ? new Set(opts.brands.map((b) => b.toLowerCase())) : null;
  const hasMembershipFilter = (opts.memberships?.length ?? 0) > 0;

  const [list, today] = await Promise.all([fetchAllBenefits(), fetchTodayBenefits()]);
  const merged = mergeBenefits(list, today);

  const ranked: RankedDeal[] = [];
  for (const b of merged) {
    if (brandFilter && !brandFilter.has(b.brand)) continue;

    // 멤버십 필터: 멤버십을 지정한 경우, 보유하지 않은 provider 전용 혜택은 제외.
    // (discountProvider == null 은 누구나 받을 수 있는 브랜드 자체 혜택)
    if (hasMembershipFilter && b.discountProvider && !myProviders.has(b.discountProvider)) continue;

    const listPrice = getListPrice(b.brand, menu);
    if (listPrice == null) continue; // 정가 미상 브랜드

    // 메뉴 매칭: 다른 메뉴 전용 혜택(예: 라떼 요청에 '아메리카노 500원 할인')은 제외
    const text = [b.title, b.conditions].filter(Boolean).join(' ');
    if (!appliesToMenu(text, menu)) continue;

    const est = estimateNetPrice(b, listPrice);
    if (!est) continue;

    ranked.push({
      rank: 0,
      brand: b.brand,
      brandLabel: b.brandLabel,
      menu,
      listPrice,
      estimatedPrice: est.net,
      saving: est.saving,
      savingPct: est.savingPct,
      confidence: est.confidence,
      basis: est.basis,
      benefitType: b.benefitType,
      provider: b.discountProvider,
      howToUse: buildHowToUse(b),
      dday: computeDday(b.endDate),
      title: b.title,
      sourceUrl: b.sourceUrl,
    });
  }

  const confRank = { high: 0, medium: 1, low: 2 } as const;
  ranked.sort(
    (a, b) =>
      a.estimatedPrice - b.estimatedPrice ||
      confRank[a.confidence] - confRank[b.confidence] ||
      // 동일 조건이면 멤버십 장벽 없는(제공자 null) 혜택 우선
      Number(a.provider != null) - Number(b.provider != null) ||
      b.savingPct - a.savingPct,
  );

  // 중복 제거: (브랜드, 제공자, 체감가) 같은 딜은 1건만 (정렬 후라 best 유지)
  const seen = new Set<string>();
  const deduped: RankedDeal[] = [];
  for (const d of ranked) {
    // 동일 딜만 제거 — basis 까지 같아야 중복으로 본다 (서로 다른 할인 메커니즘은 보존)
    const key = `${d.brand}|${d.provider ?? ''}|${d.estimatedPrice}|${d.basis}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(d);
  }

  const limit = opts.limit ?? 10;
  return deduped.slice(0, limit).map((d, i) => ({ ...d, rank: i + 1 }));
}
