import { z } from 'zod';
import { getRankedDeals } from '../engine.js';
import { getListPrice as localListPrice, DEFAULT_MENU } from '../menuPrices.js';
import { fetchServerMenuPrices } from '../apiClient.js';

/** 서버 정가(SSOT) 우선, 미배포 시 로컬 상수 폴백 */
async function resolveListPrice(brand: string, menu: string): Promise<number | null> {
  const server = await fetchServerMenuPrices();
  const p = server?.[brand]?.prices;
  if (p) return p[menu] ?? p[DEFAULT_MENU] ?? null;
  return localListPrice(brand, menu);
}

export const verifyReceiptPriceInput = {
  brand: z.string().describe('브랜드 slug (예: starbucks, mega)'),
  paidPrice: z.number().int().min(0).describe('실제 결제 금액 (원)'),
  menu: z.string().optional().describe('메뉴명 (기본: 아메리카노)'),
};

export async function verifyReceiptPriceHandler(args: {
  brand: string;
  paidPrice: number;
  menu?: string;
}) {
  const menu = args.menu ?? DEFAULT_MENU;
  const listPrice = await resolveListPrice(args.brand, menu);

  if (listPrice == null) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { error: 'UNKNOWN_BRAND', brand: args.brand, message: '정가 데이터가 없는 브랜드입니다.' },
            null,
            2,
          ),
        },
      ],
    };
  }

  // 해당 브랜드 오늘의 최저 체감가
  const deals = await getRankedDeals({ brands: [args.brand], menu, limit: 1 });
  const best = deals[0] ?? null;
  const todayBestPrice = best?.estimatedPrice ?? null;

  let verdict: 'great' | 'fair' | 'overpaid';
  let message: string;
  if (todayBestPrice != null && args.paidPrice <= todayBestPrice * 1.05) {
    // 추정 오차 5% 허용 — 오늘 최저가 수준
    verdict = 'great';
    message = `오늘 최저 체감가(${todayBestPrice}원) 수준으로 잘 구매했습니다.`;
  } else if (args.paidPrice < listPrice) {
    verdict = 'fair';
    message =
      todayBestPrice != null
        ? `정가보다는 쌌지만 더 나은 혜택(최저 ${todayBestPrice}원)이 있었습니다.`
        : '정가보다 싸게 구매했습니다.';
  } else if (args.paidPrice === listPrice) {
    verdict = 'fair';
    message = '정가에 구매했습니다. 혜택을 활용하면 더 아낄 수 있습니다.';
  } else {
    verdict = 'overpaid';
    message = `정가(${listPrice}원)보다 비싸게 결제되었습니다. 금액을 다시 확인해 보세요.`;
  }

  const payload = {
    brand: args.brand,
    menu,
    listPrice,
    todayBestPrice,
    yourPrice: args.paidPrice,
    verdict,
    message,
    betterOption: best && best.estimatedPrice < args.paidPrice
      ? {
          title: best.title,
          estimatedPrice: best.estimatedPrice,
          howToUse: best.howToUse,
          sourceUrl: best.sourceUrl,
        }
      : null,
  };
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}
