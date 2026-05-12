# Balance + P&L Summary + Trading History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the default account balance to $5,000, add a `getPortfolioSummary` backend endpoint, and add a `TradingHistory` component to the dashboard.

**Architecture:** Three targeted backend edits (service default + new method + new route) and four frontend edits (Transaction type, order mapping, api client, new component + dashboard integration). All P&L mechanics already exist; this plan wires them up into a summary endpoint and displays order history in the UI.

**Tech Stack:** Node.js, TypeScript, Express, Prisma (PostgreSQL), Vitest + Supertest (backend tests), Next.js 14, React, Tailwind CSS (frontend)

---

## File Map

| File | Change |
|------|--------|
| `financial-ai-backend/src/simulation/simulation.service.ts` | Fix default balance; add `getPortfolioSummary` method |
| `financial-ai-backend/src/simulation/simulation.router.ts` | Add `GET /accounts/:id/summary` route |
| `financial-ai-backend/src/test/simulation.test.ts` | Update default-balance test; add summary endpoint tests |
| `financial-ai-frontend/src/lib/types.ts` | Add `realizedPnL?: number \| null` to `Transaction` |
| `financial-ai-frontend/src/hooks/useSimulation.ts` | Map `realizedPnL` from raw orders |
| `financial-ai-frontend/src/lib/api.ts` | Add `getPortfolioSummary` method |
| `financial-ai-frontend/src/components/portfolio/TradingHistory.tsx` | New component — order history table |
| `financial-ai-frontend/src/app/dashboard/page.tsx` | Import + render `TradingHistory` |

---

## Task 1: Fix default starting balance

**Files:**
- Modify: `financial-ai-backend/src/simulation/simulation.service.ts:59`
- Modify: `financial-ai-backend/src/test/simulation.test.ts`

- [ ] **Step 1: Update the failing test expectation first**

In `financial-ai-backend/src/test/simulation.test.ts`, find the `'creates an account with default balance'` test (around line 44). The `mockAccount` has `balance: makeDecimal(10000)`. Update the mock and assertion to expect 5000:

```ts
// Replace the existing test (around line 44-55):
it('creates an account with default balance', async () => {
  ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(null)
  ;(prisma as any).simulationAccount.create.mockResolvedValue({
    ...mockAccount,
    balance: makeDecimal(5000),
  })
  const res = await request(app)
    .post('/api/v1/simulation/accounts')
    .set('Authorization', `Bearer ${token()}`)
    .send({ name: 'Test Account' })
  expect(res.status).toBe(201)
  expect(res.body.balance).toBe(5000)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd financial-ai-backend && npx vitest run src/test/simulation.test.ts --reporter=verbose 2>&1 | head -40
```

Expected: test `'creates an account with default balance'` fails because service still passes `10000`.

- [ ] **Step 3: Fix the default in the service**

In `financial-ai-backend/src/simulation/simulation.service.ts`, line 59, change:

```ts
data: { userId, name: body.name, balance: body.startingBalance ?? 10000 },
```

to:

```ts
data: { userId, name: body.name, balance: body.startingBalance ?? 5000 },
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd financial-ai-backend && npx vitest run src/test/simulation.test.ts --reporter=verbose 2>&1 | head -40
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
cd financial-ai-backend && git add src/simulation/simulation.service.ts src/test/simulation.test.ts
git commit -m "fix: default simulation account balance to \$5000"
```

---

## Task 2: Add `getPortfolioSummary` service method

**Files:**
- Modify: `financial-ai-backend/src/simulation/simulation.service.ts`
- Modify: `financial-ai-backend/src/test/simulation.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `financial-ai-backend/src/test/simulation.test.ts`:

```ts
describe('GET /api/v1/simulation/accounts/:id/summary', () => {
  const mockPosition = {
    id: 'pos-1', accountId: 'acct-1', symbol: 'AAPL', type: 'STOCK',
    quantity: makeDecimal(2), avgCost: makeDecimal(100),
    createdAt: new Date(), updatedAt: new Date(),
  }

  const mockSellOrder = {
    id: 'ord-1', accountId: 'acct-1', symbol: 'MSFT', assetType: 'STOCK',
    side: 'SELL', quantity: makeDecimal(1), fillPrice: makeDecimal(200),
    totalValue: makeDecimal(200), realizedPnL: makeDecimal(50),
    status: 'FILLED', createdAt: new Date(), updatedAt: new Date(),
  }

  it('returns portfolio summary with all computed fields', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({
      ...mockAccount, positions: [mockPosition],
    })
    ;(prisma as any).order.findMany.mockResolvedValue([mockSellOrder])
    ;(marketService.getPriceForAsset as any).mockResolvedValue({ price: 150 })

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/summary')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body.cashBalance).toBe(10000)        // mockAccount balance
    expect(res.body.totalInvested).toBe(200)         // 2 * 100
    expect(res.body.currentValue).toBe(300)          // 2 * 150
    expect(res.body.unrealizedPnL).toBe(100)         // 300 - 200
    expect(res.body.totalRealizedPnL).toBe(50)       // from sell order
    expect(res.body.totalPnL).toBe(150)              // 100 + 50
    expect(Array.isArray(res.body.positions)).toBe(true)
  })

  it('handles no positions and no sell orders', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({
      ...mockAccount, positions: [],
    })
    ;(prisma as any).order.findMany.mockResolvedValue([])

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/summary')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body.totalInvested).toBe(0)
    expect(res.body.currentValue).toBe(0)
    expect(res.body.totalRealizedPnL).toBe(0)
    expect(res.body.totalPnL).toBe(0)
  })

  it('falls back to avgCost when market price unavailable', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({
      ...mockAccount, positions: [mockPosition],
    })
    ;(prisma as any).order.findMany.mockResolvedValue([])
    ;(marketService.getPriceForAsset as any).mockRejectedValue(new Error('unavailable'))

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/summary')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body.currentValue).toBe(200)   // falls back to 2 * 100 avgCost
    expect(res.body.unrealizedPnL).toBe(0)    // avgCost - avgCost = 0
  })

  it('returns 404 for wrong owner', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({
      ...mockAccount, userId: 'other-user', positions: [],
    })
    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/summary')
      .set('Authorization', `Bearer ${token('user-1')}`)
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd financial-ai-backend && npx vitest run src/test/simulation.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: 4 new tests fail with 404 (route doesn't exist yet).

- [ ] **Step 3: Add `getPortfolioSummary` to the service**

In `financial-ai-backend/src/simulation/simulation.service.ts`, add the following method inside the `simulationService` object, after `getAccountForAIContext`:

```ts
async getPortfolioSummary(userId: string, accountId: string): Promise<PortfolioSummary> {
  const account = await prisma.simulationAccount.findUnique({
    where: { id: accountId },
    include: { positions: true },
  })
  assertOwner(account, userId)

  const sellOrders = await prisma.order.findMany({
    where: { accountId, side: 'SELL' },
  })
  const totalRealizedPnL = sellOrders.reduce(
    (sum, o) => sum + (o.realizedPnL ? Number(o.realizedPnL) : 0), 0
  )

  const positions = await Promise.all(account!.positions.map(enrichPosition))

  const totalInvested = positions.reduce(
    (sum, p) => sum + p.avgCost * p.quantity, 0
  )
  const currentValue = positions.reduce((sum, p) => {
    const price = p.currentPrice ?? p.avgCost
    return sum + price * p.quantity
  }, 0)
  const unrealizedPnL = currentValue - totalInvested
  const totalPnL = unrealizedPnL + totalRealizedPnL

  return {
    accountId: account!.id,
    name: account!.name,
    cashBalance: Number(account!.balance),
    totalInvested,
    currentValue,
    unrealizedPnL,
    totalRealizedPnL,
    totalPnL,
    positions,
  }
},
```

Also add `PortfolioSummary` to the imports at the top of the file:

```ts
import type {
  CreateAccountBody,
  TradeBody,
  OrderQuery,
  EnrichedPosition,
  AccountSummary,
  AccountDetail,
  FilledOrder,
  PortfolioSummary,
} from './simulation.types'
```

- [ ] **Step 4: Add the route**

In `financial-ai-backend/src/simulation/simulation.router.ts`, add after the `GET /accounts/:id/orders` route:

```ts
simulationRouter.get('/accounts/:id/summary', async (req: Request, res: Response) => {
  res.json(await simulationService.getPortfolioSummary(req.user!.userId, req.params.id as string))
})
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd financial-ai-backend && npx vitest run src/test/simulation.test.ts --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd financial-ai-backend && git add src/simulation/simulation.service.ts src/simulation/simulation.router.ts src/test/simulation.test.ts
git commit -m "feat: add getPortfolioSummary endpoint GET /accounts/:id/summary"
```

---

## Task 3: Add `realizedPnL` to frontend Transaction type and order mapping

**Files:**
- Modify: `financial-ai-frontend/src/lib/types.ts`
- Modify: `financial-ai-frontend/src/hooks/useSimulation.ts`

- [ ] **Step 1: Add `realizedPnL` to Transaction interface**

In `financial-ai-frontend/src/lib/types.ts`, update the `Transaction` interface:

```ts
export interface Transaction {
  id: string
  userId: string
  assetId: string
  type: 'BUY' | 'SELL'
  quantity: number
  price: number
  timestamp: string
  realizedPnL: number | null
  // Joined relation — included by the backend's getTransactions query
  asset: { symbol: string; type: string }
}
```

- [ ] **Step 2: Map `realizedPnL` in the order hook**

In `financial-ai-frontend/src/hooks/useSimulation.ts`, update the `transactions` mapping inside `useSimulationOrders`:

```ts
const transactions: Transaction[] = (rawOrders ?? []).map((order: any) => ({
  id: order.id,
  userId: '',
  assetId: `${accountId}-${order.symbol}`,
  type: order.side as 'BUY' | 'SELL',
  quantity: order.quantity,
  price: order.fillPrice,
  timestamp: order.createdAt,
  realizedPnL: order.realizedPnL ?? null,
  asset: { symbol: order.symbol, type: order.type },
})) ?? []
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd financial-ai-frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd financial-ai-frontend && git add src/lib/types.ts src/hooks/useSimulation.ts
git commit -m "feat: add realizedPnL to Transaction type and order mapping"
```

---

## Task 4: Add `getPortfolioSummary` to frontend API client

**Files:**
- Modify: `financial-ai-frontend/src/lib/api.ts`

- [ ] **Step 1: Add the method**

In `financial-ai-frontend/src/lib/api.ts`, add after `getSimulationAccount`:

```ts
getPortfolioSummary(accountId: string) {
  return request<{
    accountId: string
    name: string
    cashBalance: number
    totalInvested: number
    currentValue: number
    unrealizedPnL: number
    totalRealizedPnL: number
    totalPnL: number
    positions: Array<{
      symbol: string
      type: string
      quantity: number
      avgCost: number
      currentPrice: number | null
      unrealizedPnL: number | null
    }>
  }>(`/simulation/accounts/${accountId}/summary`)
},
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd financial-ai-frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd financial-ai-frontend && git add src/lib/api.ts
git commit -m "feat: add getPortfolioSummary to api client"
```

---

## Task 5: Create TradingHistory component

**Files:**
- Create: `financial-ai-frontend/src/components/portfolio/TradingHistory.tsx`

- [ ] **Step 1: Create the component**

```tsx
// financial-ai-frontend/src/components/portfolio/TradingHistory.tsx
import type { Transaction } from '../../lib/types'

interface Props {
  transactions: Transaction[]
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatUSD(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function TradingHistory({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="swiss-card text-center py-10">
        <p className="text-black/60 text-sm">No trades yet</p>
      </div>
    )
  }

  return (
    <div className="swiss-card">
      <h2 className="text-base font-bold text-black uppercase tracking-wide pb-6 border-b border-black/10">
        Trading History
      </h2>
      <div className="overflow-x-auto pt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-black/50 uppercase tracking-wide">
              <th className="pb-3 pr-4">Date</th>
              <th className="pb-3 pr-4">Symbol</th>
              <th className="pb-3 pr-4">Side</th>
              <th className="pb-3 pr-4 text-right">Qty</th>
              <th className="pb-3 pr-4 text-right">Fill Price</th>
              <th className="pb-3 pr-4 text-right">Total</th>
              <th className="pb-3 text-right">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => {
              const total = tx.quantity * tx.price
              const pnlUp = tx.realizedPnL != null && tx.realizedPnL >= 0
              return (
                <tr key={tx.id} className="border-t border-black/5">
                  <td className="py-3 pr-4 text-black/60 whitespace-nowrap">{formatDate(tx.timestamp)}</td>
                  <td className="py-3 pr-4 font-semibold text-black">{tx.asset.symbol}</td>
                  <td className="py-3 pr-4">
                    {tx.type === 'BUY' ? (
                      <span className="inline-block px-2 py-0.5 text-xs font-bold bg-black text-white">BUY</span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 text-xs font-bold border border-black text-black">SELL</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right text-black">{tx.quantity}</td>
                  <td className="py-3 pr-4 text-right text-black">{formatUSD(tx.price)}</td>
                  <td className="py-3 pr-4 text-right text-black">{formatUSD(total)}</td>
                  <td className="py-3 text-right">
                    {tx.realizedPnL != null ? (
                      <span className={`font-semibold ${pnlUp ? 'text-green-700' : 'text-red-700'}`}>
                        {pnlUp ? '+' : ''}{formatUSD(tx.realizedPnL)}
                      </span>
                    ) : (
                      <span className="text-black/20">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd financial-ai-frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd financial-ai-frontend && git add src/components/portfolio/TradingHistory.tsx
git commit -m "feat: add TradingHistory component"
```

---

## Task 6: Integrate TradingHistory into the dashboard

**Files:**
- Modify: `financial-ai-frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1: Add the import**

In `financial-ai-frontend/src/app/dashboard/page.tsx`, add to the imports block:

```ts
import { TradingHistory } from '../../components/portfolio/TradingHistory'
```

- [ ] **Step 2: Render TradingHistory below the positions section**

In `dashboard/page.tsx`, find the comment `{/* ── Empty state ── */}` (around line 204). Add `TradingHistory` after the empty state block and before the Filters section:

```tsx
{/* ── Trading History ── */}
<TradingHistory transactions={transactions} />
```

The full section order in the right panel's `space-y-8` div should now be:
1. Summary stats
2. My Positions
3. Empty state (when no positions)
4. **Trading History** ← new
5. Filters
6. Charts
7. Top Assets
8. AI Insights

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd financial-ai-frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Start the dev servers and verify in browser**

```bash
# Terminal 1
cd financial-ai-backend && npm run dev

# Terminal 2
cd financial-ai-frontend && npm run dev
```

Open http://localhost:3002 and verify:
- Dashboard shows "Trading History" section
- After buying a stock, a BUY row appears with `—` in the P&L column
- After selling a stock, a SELL row appears with green/red P&L value
- Empty state shows "No trades yet" when no orders exist

- [ ] **Step 5: Commit**

```bash
cd financial-ai-frontend && git add src/app/dashboard/page.tsx
git commit -m "feat: integrate TradingHistory into dashboard"
```
