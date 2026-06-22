// coffee.pryzm.gg 공개 brand-benefits API 클라이언트 (read-only) + 5분 인메모리 캐시.
import type { Benefit } from './types.js';

const BASE = (process.env.COFFEE_API_BASE ?? 'https://coffee.pryzm.gg/api').replace(/\/+$/, '');
const CACHE_TTL_MS = 5 * 60 * 1000;
const PAGE = 50;
const MAX_PAGES = 6; // 안전 상한 (최대 300건)

interface CacheEntry<T> {
  ts: number;
  data: T;
}
const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && now - hit.ts < CACHE_TTL_MS) return hit.data;

  // singleflight: 동시 캐시 미스 시 loader 중복 실행 방지
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const p = (async () => {
    try {
      const data = await loader();
      cache.set(key, { ts: Date.now(), data });
      return data;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

interface BenefitsListResponse {
  benefits?: Benefit[];
  items?: Benefit[];
  hasMore?: boolean;
}

async function getJson(path: string): Promise<BenefitsListResponse> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`coffee API ${path} → HTTP ${res.status}`);
  return (await res.json()) as BenefitsListResponse;
}

/** 전체 활성 혜택 (full shape, benefitType 포함). 페이지네이션 자동 처리. */
export async function fetchAllBenefits(brand?: string): Promise<Benefit[]> {
  const key = `all:${brand ?? '*'}`;
  return cached(key, async () => {
    const out: Benefit[] = [];
    for (let i = 0; i < MAX_PAGES; i++) {
      const q = new URLSearchParams({ limit: String(PAGE), offset: String(i * PAGE) });
      if (brand) q.set('brand', brand);
      const d = await getJson(`/coffeecong/brand-benefits?${q.toString()}`);
      const items: Benefit[] = d.benefits ?? [];
      out.push(...items);
      if (!d.hasMore || items.length === 0) break;
    }
    return out;
  });
}

/** 오늘 받을 수 있는 통신사·카드사 할인 (slim shape, 요일 필터 적용됨). */
export async function fetchTodayBenefits(): Promise<Benefit[]> {
  return cached('today', async () => {
    const d = await getJson('/coffeecong/brand-benefits/today');
    return (d.items ?? []) as Benefit[];
  });
}

// ── 서버 SSOT 엔드포인트 (배포 후 사용, 미배포 시 null → 로컬 폴백) ──────────

/** 서버 /cheapest 호출. 엔드포인트 미배포(404)·실패 시 null. */
export async function fetchServerCheapest(params: {
  menu?: string;
  memberships?: string[];
  brands?: string[];
  limit?: number;
}): Promise<unknown[] | null> {
  const q = new URLSearchParams();
  if (params.menu) q.set('menu', params.menu);
  if (params.memberships?.length) q.set('memberships', params.memberships.join(','));
  if (params.brands?.length) q.set('brands', params.brands.join(','));
  if (params.limit) q.set('limit', String(params.limit));
  const key = `cheapest:${q.toString()}`;
  try {
    return await cached(key, async () => {
      const res = await fetch(`${BASE}/coffeecong/brand-benefits/cheapest?${q.toString()}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`cheapest HTTP ${res.status}`);
      const d = (await res.json()) as { deals?: unknown[] };
      return Array.isArray(d.deals) ? d.deals : [];
    });
  } catch {
    return null;
  }
}

/** 서버 /menu-prices 정가 테이블. 미배포·실패 시 null. */
export async function fetchServerMenuPrices(): Promise<Record<string, { prices: Record<string, number> }> | null> {
  try {
    return await cached('menu-prices', async () => {
      const res = await fetch(`${BASE}/coffeecong/brand-benefits/menu-prices`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`menu-prices HTTP ${res.status}`);
      const d = (await res.json()) as { brands?: Record<string, { prices: Record<string, number> }> };
      return d.brands ?? {};
    });
  } catch {
    return null;
  }
}
