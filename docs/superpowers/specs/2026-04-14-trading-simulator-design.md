# AI-Powered Trading Simulator — Design Spec

**Date:** 2026-04-14
**Status:** Approved

---

## Goal

Refactor the existing financial insights backend into an AI-powered trading simulator. Replace the manual portfolio module with a simulation engine that supports multiple named virtual accounts per user, real-time market-order execution, order history tracking, and three new on-demand AI agents (Trade Coach, Risk Manager, Strategy Generator). All existing AI chatbot and analysis endpoints are preserved.

## Architecture

Single Express app, same modular structure. The `portfolio` module is deleted and replaced by a `simulation` module. Three new Prisma models (`SimulationAccount`, `Position`, `Order`) replace the old `Asset` and `Transaction` models in a single migration. Auth, market, middleware, and existing AI routes are untouched.

**Tech Stack:** Node.js · TypeScript · Express · Prisma · PostgreSQL (Neon) · Vitest · OpenAI gpt-4o-mini · Google Gemini · Yahoo Finance · Gemini Exchange

---

## Data Model

### New Enums
```prisma
enum OrderSide   { BUY  SELL }
enum OrderStatus { FILLED }     // market orders fill instantly; extensible later
```

### SimulationAccount
```prisma
model SimulationAccount {
  id        String     @id @default(cuid())
  userId    String
  name      String
  balance   Decimal    @default(10000.00) @db.Decimal(18, 2)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  positions Position[]
  orders    Order[]
  @@unique([userId, name])
}
```

### Position
```prisma
model Position {
  id        String            @id @default(cuid())
  accountId String
  symbol    String
  type      AssetType
  quantity  Decimal           @db.Decimal(18, 8)
  avgCost   Decimal           @db.Decimal(18, 8)
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt
  account   SimulationAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  @@unique([accountId, symbol])
}
```

### Order
```prisma
model Order {
  id         String            @id @default(cuid())
  accountId  String
  symbol     String
  assetType  AssetType
  side       OrderSide
  quantity   Decimal           @db.Decimal(18, 8)
  fillPrice  Decimal           @db.Decimal(18, 8)
  totalValue Decimal           @db.Decimal(18, 2)
  status     OrderStatus       @default(FILLED)
  createdAt  DateTime          @default(now())
  account    SimulationAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  @@index([accountId])
  @@index([accountId, symbol])
}
```

### Removed
- `Asset` model — deleted
- `Transaction` model — deleted
- `TransactionType` enum — deleted

### User relation update
```prisma
// Replace: assets Asset[], transactions Transaction[]
// With:
simulationAccounts SimulationAccount[]
```

---

## API Routes

All simulation routes require JWT authentication. Base path: `/api/v1/simulation`.

### Account Management
| Method | Path | Description |
|--------|------|-------------|
| POST | `/simulation/accounts` | Create account. Body: `{ name, startingBalance? }` |
| GET | `/simulation/accounts` | List all accounts for the authenticated user |
| GET | `/simulation/accounts/:id` | Get account with positions (enriched with live prices + unrealized P&L) |
| DELETE | `/simulation/accounts/:id` | Delete account (ownership enforced) |

### Trade Execution
| Method | Path | Description |
|--------|------|-------------|
| POST | `/simulation/accounts/:id/trade` | Execute market order. Body: `{ symbol, type, side, quantity }` |

### Order History
| Method | Path | Description |
|--------|------|-------------|
| GET | `/simulation/accounts/:id/orders` | Paginated order history. Query: `?symbol=&side=&limit=&offset=` |

### AI Agents (account-scoped, on-demand)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/simulation/accounts/:id/ai/chat` | Simulator Chat: freeform conversation with account context (Gemini). Body: `{ message }` |
| GET | `/simulation/accounts/:id/ai/coach` | Trade Coach: evaluate recent trading behavior |
| POST | `/simulation/accounts/:id/ai/risk` | Risk Manager: pre-trade warning. Body: `{ symbol, type, side, quantity }` |
| GET | `/simulation/accounts/:id/ai/strategy` | Strategy Generator: suggest strategies for this account |

### Existing AI Routes (unchanged)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai/chat` | Chatbot (Gemini) |
| GET | `/ai/summary` | Portfolio summary (Gemini) |
| GET | `/ai/risk-analysis` | Risk analysis (OpenAI) |
| GET | `/ai/trends` | Trend analysis (OpenAI) |
| GET | `/ai/suggestions` | Investment suggestions (OpenAI) |

---

## Service Layer

### `simulation.service.ts`

**Account management**
- `createAccount(userId, name, startingBalance?)` — creates SimulationAccount, balance defaults to 10000.00
- `getAccounts(userId)` — returns all accounts with balance
- `getAccount(userId, accountId)` — returns account + positions enriched with live price + unrealized P&L; throws 404 if not found or not owned by user
- `deleteAccount(userId, accountId)` — ownership check, then cascade delete

**Trade execution** — `executeTrade(userId, accountId, TradeBody)`
1. Fetch account, verify ownership
2. Fetch live price: `marketService.getPrice(symbol, type)`
3. Compute `totalValue = quantity × fillPrice`
4. Validate:
   - BUY: `totalValue ≤ account.balance` → throws `AppError(400, 'INSUFFICIENT_FUNDS')`
   - SELL: position exists and `position.quantity ≥ quantity` → throws `AppError(400, 'INSUFFICIENT_POSITION')`
5. Execute atomically via `prisma.$transaction([...])`:
   - Create `Order` (status: FILLED)
   - BUY: `balance -= totalValue`, upsert Position with recalculated avgCost
   - SELL: `balance += totalValue`, decrement position quantity (delete Position if quantity reaches 0)
6. Return filled Order

**avgCost recalculation on BUY:**
```
newAvgCost = (existingQty × oldAvgCost + newQty × fillPrice) / (existingQty + newQty)
```
For a new position (no prior holding): `avgCost = fillPrice`

**Order history** — `getOrders(userId, accountId, query)` — ownership check, then paginated query filtered by optional symbol/side

---

## AI Agents

All four methods live in `ai.service.ts` alongside existing methods. The chat method uses the existing Gemini client; the three structured agents use `callOpenAIAgent<T>()` (existing helper) with `gpt-4o-mini` and `response_format: { type: 'json_object' }`.

### Simulator Chat
**Method:** `simulationChat(message, accountContext)` — uses Gemini (`gemini-1.5-flash`), same model as existing `chat()`
**Input context:** account name, balance, current positions with unrealized P&L, last 10 orders. The AI is prompted as a trading simulator assistant that knows the user's virtual account state.
**Output:**
```typescript
interface SimulationChatResponse {
  reply: string   // freeform conversational response
}
```
This allows users to ask questions like "Should I sell my AAPL position?", "What's my biggest risk right now?", or "How am I doing compared to my starting balance?" and receive context-aware answers.

---

### Trade Coach
**Input context:** account name, balance, positions with unrealized P&L, last 10 orders
**Output:**
```typescript
interface TradeCoachResponse {
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F'
  strengths: string[]
  weaknesses: string[]
  recentTradeAnalysis: {
    orderId: string
    symbol: string
    assessment: 'good' | 'neutral' | 'poor'
    reasoning: string
  }[]
  coachingTip: string
}
```

### Risk Manager
**Input context:** current balance, all positions, proposed trade (symbol, type, side, quantity, estimated totalValue at current price)
**Output:**
```typescript
interface RiskManagerResponse {
  riskLevel: 'low' | 'medium' | 'high' | 'extreme'
  approved: boolean
  warnings: string[]
  positionSizePercent: number
  recommendation: string
}
```

### Strategy Generator
**Input context:** account name, balance, current positions, full order history summary (count, win/loss ratio if determinable, most traded symbols)
**Output:**
```typescript
interface StrategyGeneratorResponse {
  strategies: {
    name: string
    description: string
    suitability: 'beginner' | 'intermediate' | 'advanced'
    expectedRisk: 'low' | 'medium' | 'high'
    suggestedActions: string[]
  }[]
  rationale: string
}
```

---

## File Map

### Deleted
- `src/portfolio/portfolio.router.ts`
- `src/portfolio/portfolio.service.ts`
- `src/portfolio/portfolio.types.ts`

### Created
- `src/simulation/simulation.router.ts`
- `src/simulation/simulation.service.ts`
- `src/simulation/simulation.types.ts`
- `src/test/simulation.test.ts`
- `src/test/simulation-ai.test.ts`

### Modified
- `prisma/schema.prisma` — drop Asset/Transaction/TransactionType, add SimulationAccount/Position/Order/OrderSide/OrderStatus, update User relation
- `src/ai/ai.service.ts` — add `simulationChat`, `tradeCoach`, `riskManager`, `strategyGenerator`
- `src/ai/ai.types.ts` — add `SimulationChatResponse`, `TradeCoachResponse`, `RiskManagerResponse`, `StrategyGeneratorResponse`
- `src/ai/ai.router.ts` — add four simulation AI routes under `/simulation/accounts/:id/ai/*`
- `src/app.ts` — replace `portfolioRouter` with `simulationRouter`
- `src/test/setup.ts` — update Prisma mock: replace asset/transaction mocks with simulationAccount/position/order

### Unchanged
- `src/auth/*`
- `src/market/*`
- `src/middleware/*`
- `src/lib/*`
- `src/test/ai.test.ts`
- `src/test/auth.test.ts`
- `src/test/market.test.ts`

---

## Error Handling

All errors use the existing `AppError` class with descriptive error codes:
- `ACCOUNT_NOT_FOUND` (404) — account doesn't exist or belongs to another user
- `ACCOUNT_NAME_TAKEN` (409) — duplicate name for this user
- `INSUFFICIENT_FUNDS` (400) — buy order exceeds account balance
- `INSUFFICIENT_POSITION` (400) — sell quantity exceeds held position
- `MARKET_PRICE_UNAVAILABLE` (502) — market service failed to fetch price

---

## Testing Strategy

**`simulation.test.ts`** — covers:
- Account CRUD (create, list, get, delete, ownership enforcement)
- Trade execution: successful BUY, successful SELL, insufficient funds, insufficient position, price fetch failure
- avgCost recalculation correctness
- Order history pagination and filtering

**`simulation-ai.test.ts`** — covers:
- Simulator Chat endpoint (mocked ai.service)
- Trade Coach endpoint (mocked ai.service)
- Risk Manager endpoint (mocked ai.service)
- Strategy Generator endpoint (mocked ai.service)
- Auth enforcement on all four routes

All tests mock `../simulation/simulation.service` and `../ai/ai.service` directly (same pattern as existing `ai.test.ts`) to avoid Prisma/OpenAI instantiation in tests.
