# Stock Trading Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing simulation module with realized P&L tracking, a `getPortfolio` endpoint, `buyStock`/`sellStock` named aliases, and a $5,000 default starting balance.

**Architecture:** Add a nullable `realizedPnL` column to the `Order` table (computed at sell time from avg cost). Extract portfolio aggregation into a new `portfolio.service.ts`. Add named aliases and a new route to the existing simulation service and router.

**Tech Stack:** TypeScript, Express, Prisma, PostgreSQL, Vitest, Zod

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `realizedPnL` to `Order`; set `SimulationAccount` default balance to 5000 |
| `prisma/migrations/` | Create | Prisma auto-generates via `migrate dev` |
| `src/simulation/simulation.types.ts` | Modify | Add `realizedPnL` to `FilledOrder`; add `PortfolioSummary` type |
| `src/simulation/simulation.service.ts` | Modify | Compute + store `realizedPnL` in `executeTrade`; add `buyStock`/`sellStock`; update order mapping |
| `src/simulation/portfolio.service.ts` | Create | `getPortfolio` — aggregates positions + realized P&L into a `PortfolioSummary` |
| `src/simulation/simulation.router.ts` | Modify | Add `GET /accounts/:id/portfolio` route |
| `src/test/setup.ts` | Modify | Add `aggregate` mock to `prisma.order` |
| `src/test/simulation.test.ts` | Modify | Assert `realizedPnL` on SELL orders; update default balance expectation |
| `src/test/portfolio.test.ts` | Create | Unit tests for `getPortfolio` covering all P&L scenarios |

---

## Task 1: Schema — add `realizedPnL` and update default balance

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update `schema.prisma`**

In `prisma/schema.prisma`, make two changes:

**Change 1** — add `realizedPnL` field to the `Order` model (after the `totalValue` line):

```prisma
model Order {
  id          String            @id @default(cuid())
  accountId   String
  symbol      String
  assetType   AssetType
  side        OrderSide
  quantity    Decimal           @db.Decimal(18, 8)
  fillPrice   Decimal           @db.Decimal(18, 8)
  totalValue  Decimal           @db.Decimal(18, 2)
  realizedPnL Decimal?          @db.Decimal(18, 8)
  status      OrderStatus       @default(FILLED)
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  account     SimulationAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([accountId])
  @@index([accountId, symbol])
}
```

**Change 2** — update the default balance on `SimulationAccount`:

```prisma
balance Decimal @default(5000.00) @db.Decimal(18, 2)
```

- [ ] **Step 2: Generate and run the migration**

```bash
cd financial-ai-backend
npx prisma migrate dev --name add_realized_pnl_to_order
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected output: `Generated Prisma Client ...`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add realizedPnL to Order, set default account balance to 5000"
```

---

## Task 2: Types — add `realizedPnL` to `FilledOrder` and add `PortfolioSummary`

**Files:**
- Modify: `src/simulation/simulation.types.ts`

- [ ] **Step 1: Update `FilledOrder` interface**

Replace the existing `FilledOrder` interface in `src/simulation/simulation.types.ts`:

```ts
export interface FilledOrder {
  id: string
  accountId: string
  symbol: string
  assetType: string
  side: string
  quantity: number
  fillPrice: number
  totalValue: number
  realizedPnL: number | null  // null for BUY orders; dollar gain/loss locked in on SELL
  status: string
  createdAt: Date
  updatedAt: Date
}
```

- [ ] **Step 2: Add `PortfolioSummary` interface**

Append to the bottom of `src/simulation/simulation.types.ts`:

```ts
export interface PortfolioSummary {
  accountId:        string
  name:             string
  cashBalance:      number        // uninvested cash remaining in the account
  totalInvested:    number        // sum of (avgCost * quantity) across all open positions
  currentValue:     number        // sum of (currentPrice * quantity) across all open positions
  unrealizedPnL:    number        // currentValue - totalInvested (paper gain/loss on open positions)
  totalRealizedPnL: number        // sum of all realizedPnL from SELL orders on this account
  totalPnL:         number        // unrealizedPnL + totalRealizedPnL (full performance picture)
  positions:        EnrichedPosition[]
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd financial-ai-backend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/simulation/simulation.types.ts
git commit -m "feat: add realizedPnL to FilledOrder type, add PortfolioSummary type"
```

---

## Task 3: Simulation service — compute `realizedPnL` and add named aliases

**Files:**
- Modify: `src/simulation/simulation.service.ts`

- [ ] **Step 1: Compute `realizedPnL` before the transaction in `executeTrade`**

In `src/simulation/simulation.service.ts`, locate the block that starts with:

```ts
const totalValue       = body.quantity * fillPrice
```

Add the `realizedPnL` calculation immediately after it:

```ts
const totalValue       = body.quantity * fillPrice
const balance          = Number(account!.balance)
const existingPosition = account!.positions[0] ?? null

// Realized P&L: how much more (or less) the sell price is vs. the weighted avg cost paid.
// Only applies to SELL orders — BUY orders have no realized gain or loss yet.
const realizedPnL = body.side === 'SELL' && existingPosition
  ? (fillPrice - Number(existingPosition.avgCost)) * body.quantity
  : null
```

- [ ] **Step 2: Pass `realizedPnL` into `order.create` inside the transaction**

Locate the `tx.order.create` call inside the `$transaction` block and add `realizedPnL`:

```ts
const newOrder = await tx.order.create({
  data: {
    accountId, symbol: body.symbol, assetType: body.type,
    side: body.side, quantity: body.quantity, fillPrice, totalValue,
    realizedPnL,
    status: 'FILLED',
  },
})
```

- [ ] **Step 3: Include `realizedPnL` in the `FilledOrder` returned from `executeTrade`**

Locate the `return` statement at the end of `executeTrade` that maps `order` fields, and add `realizedPnL`:

```ts
return {
  id: order.id, accountId: order.accountId, symbol: order.symbol,
  assetType: order.assetType, side: order.side,
  quantity: Number(order.quantity), fillPrice: Number(order.fillPrice),
  totalValue: Number(order.totalValue),
  realizedPnL: order.realizedPnL !== null && order.realizedPnL !== undefined
    ? Number(order.realizedPnL)
    : null,
  status: order.status,
  createdAt: order.createdAt, updatedAt: order.updatedAt,
}
```

- [ ] **Step 4: Include `realizedPnL` in `getOrders` mapping**

Locate the `.map` inside `getOrders` that returns orders and add `realizedPnL`:

```ts
return orders.map(o => ({
  id: o.id, accountId: o.accountId, symbol: o.symbol,
  assetType: o.assetType, side: o.side,
  quantity: Number(o.quantity), fillPrice: Number(o.fillPrice),
  totalValue: Number(o.totalValue),
  realizedPnL: o.realizedPnL !== null && o.realizedPnL !== undefined
    ? Number(o.realizedPnL)
    : null,
  status: o.status,
  createdAt: o.createdAt, updatedAt: o.updatedAt,
}))
```

- [ ] **Step 5: Add `buyStock` and `sellStock` named aliases**

Append these two methods to the `simulationService` object (before the closing `}`):

```ts
// Named alias for buying — delegates to executeTrade with side fixed to 'BUY'.
// Provided as a convenience so callers don't need to construct a TradeBody manually.
async buyStock(
  userId: string,
  accountId: string,
  symbol: string,
  type: 'STOCK' | 'CRYPTO',
  quantity: number,
): Promise<FilledOrder> {
  return this.executeTrade(userId, accountId, { symbol, type, side: 'BUY', quantity })
},

// Named alias for selling — delegates to executeTrade with side fixed to 'SELL'.
async sellStock(
  userId: string,
  accountId: string,
  symbol: string,
  type: 'STOCK' | 'CRYPTO',
  quantity: number,
): Promise<FilledOrder> {
  return this.executeTrade(userId, accountId, { symbol, type, side: 'SELL', quantity })
},
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd financial-ai-backend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/simulation/simulation.service.ts
git commit -m "feat: track realizedPnL on sell orders, add buyStock/sellStock aliases"
```

---

## Task 4: Portfolio service — `getPortfolio`

**Files:**
- Create: `src/simulation/portfolio.service.ts`

- [ ] **Step 1: Write the failing test first**

Create `src/test/portfolio.test.ts`:

```ts
// financial-ai-backend/src/test/portfolio.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { portfolioService } from '../simulation/portfolio.service'
import { prisma } from '../lib/prisma'
import { marketService } from '../market/market.service'

vi.mock('../market/market.service', () => ({
  marketService: { getPriceForAsset: vi.fn() },
}))

function makeDecimal(n: number) {
  return { toNumber: () => n }
}

const baseAccount = {
  id: 'acct-1', userId: 'user-1', name: 'Test Portfolio',
  balance: makeDecimal(3000), createdAt: new Date(), updatedAt: new Date(),
}

describe('portfolioService.getPortfolio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns zero P&L for an account with no positions', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({ ...baseAccount, positions: [] })
    ;(prisma as any).order.aggregate.mockResolvedValue({ _sum: { realizedPnL: null } })

    const result = await portfolioService.getPortfolio('user-1', 'acct-1')

    expect(result.cashBalance).toBe(3000)
    expect(result.totalInvested).toBe(0)
    expect(result.currentValue).toBe(0)
    expect(result.unrealizedPnL).toBe(0)
    expect(result.totalRealizedPnL).toBe(0)
    expect(result.totalPnL).toBe(0)
    expect(result.positions).toHaveLength(0)
  })

  it('calculates unrealized P&L for open positions', async () => {
    const position = {
      id: 'pos-1', accountId: 'acct-1', symbol: 'AAPL', type: 'STOCK',
      quantity: makeDecimal(10), avgCost: makeDecimal(150),
      createdAt: new Date(), updatedAt: new Date(),
    }
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({
      ...baseAccount, positions: [position],
    })
    ;(prisma as any).order.aggregate.mockResolvedValue({ _sum: { realizedPnL: null } })
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 180, type: 'STOCK', timestamp: new Date().toISOString(),
    })

    const result = await portfolioService.getPortfolio('user-1', 'acct-1')

    // totalInvested = 10 shares * $150 avg cost = $1500
    expect(result.totalInvested).toBe(1500)
    // currentValue = 10 shares * $180 current price = $1800
    expect(result.currentValue).toBe(1800)
    // unrealizedPnL = $1800 - $1500 = $300
    expect(result.unrealizedPnL).toBe(300)
    expect(result.totalRealizedPnL).toBe(0)
    expect(result.totalPnL).toBe(300)
  })

  it('includes totalRealizedPnL from past sells', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({ ...baseAccount, positions: [] })
    ;(prisma as any).order.aggregate.mockResolvedValue({ _sum: { realizedPnL: makeDecimal(250) } })

    const result = await portfolioService.getPortfolio('user-1', 'acct-1')

    expect(result.totalRealizedPnL).toBe(250)
    expect(result.totalPnL).toBe(250)
  })

  it('combines unrealized and realized P&L in totalPnL', async () => {
    const position = {
      id: 'pos-1', accountId: 'acct-1', symbol: 'TSLA', type: 'STOCK',
      quantity: makeDecimal(5), avgCost: makeDecimal(200),
      createdAt: new Date(), updatedAt: new Date(),
    }
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({
      ...baseAccount, positions: [position],
    })
    // $100 realized from a previous sell
    ;(prisma as any).order.aggregate.mockResolvedValue({ _sum: { realizedPnL: makeDecimal(100) } })
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'TSLA', price: 220, type: 'STOCK', timestamp: new Date().toISOString(),
    })

    const result = await portfolioService.getPortfolio('user-1', 'acct-1')

    // unrealizedPnL = (220 - 200) * 5 = $100
    expect(result.unrealizedPnL).toBe(100)
    // totalRealizedPnL = $100 from past sell
    expect(result.totalRealizedPnL).toBe(100)
    // totalPnL = $100 unrealized + $100 realized = $200
    expect(result.totalPnL).toBe(200)
  })

  it('falls back to avgCost when market price is unavailable', async () => {
    const position = {
      id: 'pos-1', accountId: 'acct-1', symbol: 'AAPL', type: 'STOCK',
      quantity: makeDecimal(10), avgCost: makeDecimal(150),
      createdAt: new Date(), updatedAt: new Date(),
    }
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({
      ...baseAccount, positions: [position],
    })
    ;(prisma as any).order.aggregate.mockResolvedValue({ _sum: { realizedPnL: null } })
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('timeout')
    )

    const result = await portfolioService.getPortfolio('user-1', 'acct-1')

    // Falls back to avgCost — unrealizedPnL is 0, not an error
    expect(result.unrealizedPnL).toBe(0)
    expect(result.positions[0].currentPrice).toBeNull()
  })

  it('throws 404 for account not owned by user', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({
      ...baseAccount, userId: 'other-user', positions: [],
    })

    await expect(portfolioService.getPortfolio('user-1', 'acct-1')).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd financial-ai-backend
npx vitest run src/test/portfolio.test.ts
```

Expected: FAIL — `Cannot find module '../simulation/portfolio.service'`

- [ ] **Step 3: Add `aggregate` to the Prisma mock in `setup.ts`**

In `src/test/setup.ts`, add `aggregate` to the `order` mock object:

```ts
order: {
  create: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  aggregate: vi.fn(),
},
```

- [ ] **Step 4: Create `portfolio.service.ts`**

Create `src/simulation/portfolio.service.ts`:

```ts
// financial-ai-backend/src/simulation/portfolio.service.ts
import { prisma } from '../lib/prisma'
import { marketService } from '../market/market.service'
import { AppError } from '../lib/errors'
import type { EnrichedPosition, PortfolioSummary } from './simulation.types'

// Fetches the current market price for a position and computes unrealized P&L.
// Falls back gracefully if market data is unavailable — returns null for price/pnl
// rather than throwing, so the portfolio view still works during outages.
async function enrichPosition(pos: {
  id: string
  accountId: string
  symbol: string
  type: string
  quantity: { toNumber(): number }
  avgCost: { toNumber(): number }
  createdAt: Date
  updatedAt: Date
}): Promise<EnrichedPosition> {
  const quantity = pos.quantity.toNumber()
  const avgCost  = pos.avgCost.toNumber()
  try {
    const price = await marketService.getPriceForAsset(pos.symbol, pos.type as 'STOCK' | 'CRYPTO')
    return {
      id: pos.id, accountId: pos.accountId, symbol: pos.symbol, type: pos.type,
      quantity, avgCost,
      currentPrice: price.price,
      // Unrealized P&L per position: gain/loss if this position were closed right now
      unrealizedPnL: (price.price - avgCost) * quantity,
      createdAt: pos.createdAt, updatedAt: pos.updatedAt,
    }
  } catch {
    return {
      id: pos.id, accountId: pos.accountId, symbol: pos.symbol, type: pos.type,
      quantity, avgCost, currentPrice: null, unrealizedPnL: null,
      createdAt: pos.createdAt, updatedAt: pos.updatedAt,
    }
  }
}

export const portfolioService = {

  async getPortfolio(userId: string, accountId: string): Promise<PortfolioSummary> {
    const account = await prisma.simulationAccount.findUnique({
      where: { id: accountId },
      include: { positions: true },
    })

    if (!account || account.userId !== userId)
      throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND')

    // Enrich all open positions with current market prices
    const positions = await Promise.all(account.positions.map(enrichPosition))

    // Total invested = cost basis of all shares currently held
    const totalInvested = positions.reduce(
      (sum, p) => sum + p.avgCost * p.quantity,
      0,
    )

    // Current value = market value of open positions.
    // Falls back to avgCost when price is unavailable so unrealizedPnL reads 0
    // rather than producing NaN or erroring out.
    const currentValue = positions.reduce(
      (sum, p) => sum + (p.currentPrice ?? p.avgCost) * p.quantity,
      0,
    )

    // Unrealized P&L = paper gain or loss if all open positions were closed right now
    const unrealizedPnL = currentValue - totalInvested

    // Realized P&L = locked-in gains/losses summed across every past SELL order
    const { _sum } = await prisma.order.aggregate({
      where: { accountId, side: 'SELL' },
      _sum: { realizedPnL: true },
    })
    const totalRealizedPnL = Number(_sum.realizedPnL ?? 0)

    // Total P&L = full performance picture: what you've locked in + what you'd lock in now
    const totalPnL = unrealizedPnL + totalRealizedPnL

    return {
      accountId:        account.id,
      name:             account.name,
      cashBalance:      Number(account.balance),
      totalInvested,
      currentValue,
      unrealizedPnL,
      totalRealizedPnL,
      totalPnL,
      positions,
    }
  },
}
```

- [ ] **Step 5: Run the tests and verify they pass**

```bash
cd financial-ai-backend
npx vitest run src/test/portfolio.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/simulation/portfolio.service.ts src/test/portfolio.test.ts src/test/setup.ts
git commit -m "feat: add portfolioService.getPortfolio with full P&L summary"
```

---

## Task 5: Router — add `GET /accounts/:id/portfolio` endpoint

**Files:**
- Modify: `src/simulation/simulation.router.ts`

- [ ] **Step 1: Write the failing route test**

Add a new `describe` block to `src/test/simulation.test.ts`. Append it after the last `describe` block:

```ts
describe('GET /api/v1/simulation/accounts/:id/portfolio', () => {
  const mockPortfolio = {
    accountId: 'acct-1',
    name: 'Test Account',
    cashBalance: 3200,
    totalInvested: 1500,
    currentValue: 1800,
    unrealizedPnL: 300,
    totalRealizedPnL: 100,
    totalPnL: 400,
    positions: [],
  }

  it('returns portfolio summary for account owner', async () => {
    // portfolioService is mocked — this tests the route wiring, not the service logic
    const { portfolioService } = await import('../simulation/portfolio.service')
    vi.mocked(portfolioService.getPortfolio).mockResolvedValue(mockPortfolio as any)

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/portfolio')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body.cashBalance).toBe(3200)
    expect(res.body.totalPnL).toBe(400)
    expect(res.body.unrealizedPnL).toBe(300)
    expect(res.body.totalRealizedPnL).toBe(100)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/simulation/accounts/acct-1/portfolio')
    expect(res.status).toBe(401)
  })
})
```

Also add the `portfolioService` mock at the top of `simulation.test.ts`, alongside the existing `vi.mock` calls:

```ts
vi.mock('../simulation/portfolio.service', () => ({
  portfolioService: { getPortfolio: vi.fn() },
}))
```

- [ ] **Step 2: Run the new test to verify it fails**

```bash
cd financial-ai-backend
npx vitest run src/test/simulation.test.ts -t "portfolio"
```

Expected: FAIL — 404 (route not yet registered).

- [ ] **Step 3: Add the route to `simulation.router.ts`**

In `src/simulation/simulation.router.ts`, add the import for `portfolioService` at the top with the other imports:

```ts
import { portfolioService } from './portfolio.service'
```

Then add the new route after the `GET /accounts/:id` route:

```ts
simulationRouter.get('/accounts/:id/portfolio', async (req: Request, res: Response) => {
  res.json(await portfolioService.getPortfolio(req.user!.userId, req.params.id as string))
})
```

- [ ] **Step 4: Run all simulation tests**

```bash
cd financial-ai-backend
npx vitest run src/test/simulation.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run the full test suite**

```bash
cd financial-ai-backend
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/simulation/simulation.router.ts src/test/simulation.test.ts
git commit -m "feat: add GET /accounts/:id/portfolio endpoint"
```

---

## Task 6: Update existing tests for `realizedPnL`

**Files:**
- Modify: `src/test/simulation.test.ts`

- [ ] **Step 1: Update the SELL order mock to include `realizedPnL`**

In `simulation.test.ts`, find the `filledOrder` fixture inside `POST /trade` describe block and add `realizedPnL`:

```ts
const filledOrder = {
  id: 'order-1', accountId: 'acct-1', symbol: 'AAPL', assetType: 'STOCK', side: 'BUY',
  quantity: makeDecimal(10), fillPrice: makeDecimal(180), totalValue: makeDecimal(1800),
  realizedPnL: null,
  status: 'FILLED', createdAt: new Date(), updatedAt: new Date(),
}
```

- [ ] **Step 2: Assert `realizedPnL` is `null` on a BUY response**

In the test `'executes a BUY order and returns filled order'`, add:

```ts
expect(res.body.realizedPnL).toBeNull()
```

- [ ] **Step 3: Add a SELL order mock with `realizedPnL` and assert the value**

In the test `'executes a SELL order for an existing position'`, update the mocked order return and add an assertion. Find the `order.create.mockResolvedValue` call and update it:

```ts
;(prisma as any).order.create.mockResolvedValue({
  ...filledOrder,
  side: 'SELL',
  // avgCost was 170, fillPrice is 185, quantity is 10 → realizedPnL = (185 - 170) * 10 = 150
  realizedPnL: makeDecimal(150),
})
```

Then add to the assertions in that test:

```ts
expect(res.body.realizedPnL).toBe(150)
```

- [ ] **Step 4: Update the default balance test expectation**

In the test `'creates an account with default balance'`, the mock returns `balance: makeDecimal(10000)`. Update the mock and assertion to reflect the new $5,000 default:

```ts
// Update mock
;(prisma as any).simulationAccount.create.mockResolvedValue({
  ...mockAccount,
  balance: makeDecimal(5000),
})

// Update assertion
expect(res.body.balance).toBe(5000)
```

Also update the `mockAccount` fixture at the top of the file:

```ts
const mockAccount = {
  id: 'acct-1', userId: 'user-1', name: 'Test Account',
  balance: makeDecimal(5000), createdAt: new Date(), updatedAt: new Date(),
}
```

- [ ] **Step 5: Run the full test suite**

```bash
cd financial-ai-backend
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/test/simulation.test.ts
git commit -m "test: update simulation tests for realizedPnL and 5000 default balance"
```

---

## Done

All six tasks complete. The simulation module now:
- Tracks realized P&L on every sell order (stored on `Order.realizedPnL`)
- Exposes `buyStock` / `sellStock` as named aliases on `simulationService`
- Provides `GET /simulation/accounts/:id/portfolio` returning a full `PortfolioSummary`
- Defaults new accounts to $5,000 starting balance
