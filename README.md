# ☕ coffee-price-mcp

**"오늘 커피 가장 싸게 먹는 법"** — read-only MCP 서버.

[coffee.pryzm.gg](https://coffee.pryzm.gg) 의 공개 브랜드 혜택 API(`/coffeecong/brand-benefits/*`)를 감싸고, 브랜드별 메뉴 **정가 상수**로 **체감가(정가 − 할인)** 를 계산해 랭킹합니다. DB·시크릿 없음 — 공개 API만 호출하는 얇은 래퍼라서 그대로 가져다 쓰면 됩니다.

> Claude Code · OpenAI Codex · Gemini CLI 어디서든 **한 줄**로 연결됩니다. 설치(clone/build)도 필요 없습니다 — `npx` 가 GitHub에서 바로 받아 빌드·실행합니다.

---

## 🚀 빠른 연결 (설치 불필요)

세 도구 모두 아래 한 가지 실행 명령을 공유합니다:

```
npx -y github:jeonghwanko/coffee-price-mcp
```

> Node.js 18+ 만 있으면 됩니다. 최초 실행 시 GitHub에서 받아 자동 빌드하므로 몇 초 걸리고, 이후 캐시됩니다.

### Claude Code

가장 간단 — 터미널에서:

```bash
claude mcp add coffee-price -- npx -y github:jeonghwanko/coffee-price-mcp
```

또는 `.mcp.json`(프로젝트) / `~/.claude.json`(전역)에 직접:

```json
{
  "mcpServers": {
    "coffee-price": {
      "command": "npx",
      "args": ["-y", "github:jeonghwanko/coffee-price-mcp"]
    }
  }
}
```

### OpenAI Codex CLI

`~/.codex/config.toml` 에 추가:

```toml
[mcp_servers.coffee-price]
command = "npx"
args = ["-y", "github:jeonghwanko/coffee-price-mcp"]
```

### Gemini CLI

`~/.gemini/settings.json` 에 추가:

```json
{
  "mcpServers": {
    "coffee-price": {
      "command": "npx",
      "args": ["-y", "github:jeonghwanko/coffee-price-mcp"]
    }
  }
}
```

연결 후 *"오늘 제일 싼 커피는?"* 이라고 물어보면 됩니다.

---

## 🛠 Tools (모두 read-only)

| tool | 설명 | 주요 인자 |
|------|------|-----------|
| `get_cheapest_coffee` | 오늘 가장 싸게 먹을 수 있는 커피 TOP N. 체감가 오름차순. | `memberships`, `menu`, `brands`, `limit` |
| `search_coffee_deals` | 혜택 검색/필터. 각 혜택에 체감가 주석. | `query`, `brand`, `provider`, `benefitType`, `todayOnly` |
| `verify_receipt_price` | 내가 낸 가격 적정성 점검 → great/fair/overpaid + 더 나은 혜택 제시. | `brand`, `paidPrice`, `menu` |

지원 브랜드: starbucks, mega, compose, twosome, coffeebean, bluebottle, hollys, ediya, paik, theventi, gongcha

---

## 🧮 체감가 엔진 (`src/pricing.ts`)

실데이터상 `discountPct`가 거의 항상 null이라 **제목 텍스트 파싱**이 핵심입니다:

1. 명시적 `discountPct` → `정가 × (1 − pct/100)` (신뢰도 high)
2. 무료 음료 ('음료' 인접 '무료/증정') → 0원
3. 퍼센트 ("최대 20%")
4. BOGO ("1+1", "2+1") → 음료당 환산
5. 정액 ("500원 할인")
6. 산정 불가 → 랭킹 제외

원두·MD·굿즈 등 **음료가 아닌 대상의 할인은 제외**합니다(제목 가드). 마케팅 요약은 오탐이 잦아 파싱에서 제외.

---

## ⚙️ 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `COFFEE_API_BASE` | `https://coffee.pryzm.gg/api` | 혜택 API 베이스. 로컬 개발 시 `http://localhost:4000` |

config의 `env` 블록으로 덮어쓸 수 있습니다.

---

## 🧑‍💻 로컬 개발

```bash
git clone https://github.com/jeonghwanko/coffee-price-mcp.git
cd coffee-price-mcp
npm install
npm run build      # tsc → dist/
npm test           # vitest (pricing/engine 테스트)
npm start          # node dist/index.js (stdio)
```

소스에서 직접 실행하도록 config를 바꾸려면:

```json
{ "command": "node", "args": ["/절대/경로/coffee-price-mcp/dist/index.js"] }
```

---

## 📦 npm 게시 (선택)

`npx github:` 방식은 매 실행마다 GitHub에서 받아 빌드합니다. 더 빠른 시작을 원하면 npm에 게시하세요:

```bash
npm publish --access public
```

게시 후에는 모든 config에서 `github:jeonghwanko/coffee-price-mcp` 를 `coffee-price-mcp` 로 바꾸면 됩니다.

---

## 라이선스

[MIT](./LICENSE) · 데이터 출처: [coffee.pryzm.gg](https://coffee.pryzm.gg) 공개 혜택 API
