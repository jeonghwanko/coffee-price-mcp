#!/usr/bin/env node
// coffee-price-mcp — "오늘 커피 가장 싸게 먹는 법" read-only MCP 서버.
// coffee.pryzm.gg 공개 brand-benefits API + 브랜드 정가 상수로 체감가를 계산해 랭킹한다.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  getCheapestCoffeeInput,
  getCheapestCoffeeHandler,
} from './tools/getCheapestCoffee.js';
import {
  searchCoffeeDealsInput,
  searchCoffeeDealsHandler,
} from './tools/searchCoffeeDeals.js';
import {
  verifyReceiptPriceInput,
  verifyReceiptPriceHandler,
} from './tools/verifyReceiptPrice.js';

const server = new McpServer({
  name: 'coffee-price',
  version: '0.1.0',
});

server.tool(
  'get_cheapest_coffee',
  '오늘 가장 싸게 먹을 수 있는 커피 TOP N. 보유 멤버십/카드를 주면 받을 수 있는 혜택만 골라 체감가(정가-할인) 오름차순으로 랭킹한다.',
  getCheapestCoffeeInput,
  getCheapestCoffeeHandler,
);

server.tool(
  'search_coffee_deals',
  '커피 혜택 검색/필터 (브랜드·통신사/카드사·유형·키워드·오늘만). 각 혜택의 체감가를 함께 반환한다.',
  searchCoffeeDealsInput,
  searchCoffeeDealsHandler,
);

server.tool(
  'verify_receipt_price',
  '내가 낸 커피 가격이 적정한지 점검. 정가와 오늘 최저 체감가를 비교해 great/fair/overpaid 판정 + 더 나은 혜택을 제시한다. (영수증 제출이 아니라 가격 점검용 read-only)',
  verifyReceiptPriceInput,
  verifyReceiptPriceHandler,
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio 서버는 stdout 을 프로토콜에 쓰므로 로그는 stderr 로만.
  process.stderr.write('[coffee-price-mcp] ready\n');
}

main().catch((err) => {
  process.stderr.write(`[coffee-price-mcp] fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
});
