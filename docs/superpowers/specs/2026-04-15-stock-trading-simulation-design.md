# Stock Trading Simulation — Design Spec

**Date:** 2026-04-15
**Status:** Approved
**Scope:** Extend `financial-ai-backend` simulation module

---

## Overview

Extend the existing simulation system in `financial-ai-backend` to add:
1. Realized P&L tracking per sell order (stored on the `Order` table)
2. A `getPortfolio` function and endpoint returning a full account P&L summary
3. Named `buyStock` / `sellStock` aliases on the simulation service
4. Default starting balance changed from $10,000 to $5,000

All changes extend the existing codebase. No existing behavior is removed or broken.

---

## Approach

**Option B — Extract a portfolio module.**

- Trade execution logic stays in `simulation.service.ts`
- Portfolio view logic (aggregation, P&L summary) moves to a new `portfolio.service.ts`
- Named `buyStock` / `sellStock` are thin wrappers on `executeTrade` in `simulation.service.ts`
- One new `GET` endpoint added to the existing `simulation.router.ts`

---

## Section 1: Schema & Data Layer

### `Order` table — add `realizedPnL`

```prisma
model Order {
  // ... existing fields ...
  realizedPnL Decimal? @db.Decimal(18, 8)
  // null for BUY orders; (fillPrice - avgCost) * quantity for SELL orders
}
```

- Nullable: BUY orders carry no realized P&L
- Non-breaking: existing rows get `NULL`, which is semantically correct
- Migration name: `add_realized_pnl_to_order`

### `SimulationAccount` — default balance

```prisma
model SimulationAccount {
  balance Decimal @default(5000.00) @db.Decimal(18, 2)
}
```

- Affects new accounts only; existing accounts are unchanged

---

## Section 2: Trade Execution Changes (`simulation.service.ts`)

### Realized P&L calculation on SELL

Inside `executeTrade`, capture avg cost from `existingPosition` before the `$transaction` block and store it on the `Order` record:

```ts
// Realized P&L on a sell: how much more (or less) we sold for vs. what we paid
const realizedPnL = body.side === 'SELL'
  ? (fillPrice - Number(existingPosition!.avgCost)) * body.quantity
  : null
```

No additional DB round-trip — the value is computed from data already loaded.

### `FilledOrder` type update

```ts
type FilledOrder = {
  // ... existing fields ...
  realizedPnL: number | null  // null for BUY; dollar gain/loss for SELL
}
```

### Named aliases

Added to `simulationService` as one-liners:

```ts
buyStock(userId, accountId, symbol, type, quantity)
  // delegates to executeTrade with side: 'BUY'

sellStock(userId, accountId, symbol, type, quantity)
  // delegates to executeTrade with side: 'SELL'
```

No duplicated logic.

---

## Section 3: Portfolio Module (`portfolio.service.ts`)

### New file: `src/simulation/portfolio.service.ts`

**`getPortfolio(userId, accountId)`** returns:

```ts
type PortfolioSummary = {
  accountId:        string
  name:             string
  cashBalance:      number   // uninvested cash remaining
  totalInvested:    number   // sum of (avgCost * quantity) across all open positions
  currentValue:     number   // sum of (currentPrice * quantity) across all open positions
  unrealizedPnL:    number   // currentValue - totalInvested (paper gain/loss on open positions)
  totalRealizedPnL: number   // sum of all realizedPnL from SELL orders on this account
  totalPnL:         number   // unrealizedPnL + totalRealizedPnL
  positions:        EnrichedPosition[]
}
```

**P&L calculation logic:**

```ts
// Total invested = cost basis of shares still held
const totalInvested = positions.reduce((sum, p) => sum + p.avgCost * p.quantity, 0)

// Current value = market value of open positions
const currentValue = positions.reduce(
  (sum, p) => sum + (p.currentPrice ?? p.avgCost) * p.quantity, 0
)

// Unrealized P&L = paper gain/loss if all open positions were closed now
const unrealizedPnL = currentValue - totalInvested

// Realized P&L = locked-in gains/losses from all past sells
const { _sum } = await prisma.order.aggregate({
  where: { accountId, side: 'SELL' },
  _sum: { realizedPnL: true },
})
const totalRealizedPnL = Number(_sum.realizedPnL ?? 0)

// Total P&L = combined realized + unrealized performance
const totalPnL = unrealizedPnL + totalRealizedPnL
```

Falls back to `avgCost` as current price when market data is unavailable (same pattern as existing `enrichPosition`).

### New API endpoint

Added to existing `simulation.router.ts`:

```
GET /simulation/accounts/:accountId/portfolio
```

Response: `PortfolioSummary`

---

## Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `realizedPnL` to `Order`; change `SimulationAccount` default balance to 5000 |
| `prisma/migrations/` | New migration: `add_realized_pnl_to_order` |
| `src/simulation/simulation.service.ts` | Compute + store `realizedPnL` in `executeTrade`; add `buyStock`/`sellStock` aliases; update `FilledOrder` type |
| `src/simulation/simulation.types.ts` | Add `realizedPnL` to `FilledOrder`; add `PortfolioSummary` type |
| `src/simulation/portfolio.service.ts` | New file — `getPortfolio` implementation |
| `src/simulation/simulation.router.ts` | Add `GET /accounts/:accountId/portfolio` route |

---

## Error Handling

No new error cases. Existing guards cover:
- `INSUFFICIENT_FUNDS` on buy
- `INSUFFICIENT_POSITION` on sell
- `MARKET_PRICE_UNAVAILABLE` when price fetch fails (portfolio falls back to avgCost)

---

## Testing

- Unit test `getPortfolio` with mocked Prisma: verify P&L math for buy-only, sell-at-profit, sell-at-loss, mixed scenarios
- Existing `executeTrade` tests extended to assert `realizedPnL` is `null` on BUY and correct value on SELL
