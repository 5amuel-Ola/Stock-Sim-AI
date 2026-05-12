# Balance + P&L Summary + Trading History — Design Spec
_Date: 2026-04-16_

## Overview

Three backend changes and one new frontend component:
1. Correct the default starting balance from $10,000 → $5,000.
2. Implement `getPortfolioSummary` and expose it via a new API route.
3. Add a `TradingHistory` frontend component to the dashboard account detail view.

All other P&L mechanics (BUY/SELL balance updates, `realizedPnL` on orders, weighted `avgCost` on positions) are already implemented and do not need to change.

---

## Change 1 — Default Starting Balance

**File:** `financial-ai-backend/src/simulation/simulation.service.ts:59`

The schema already has `@default(5000.00)`. The service overrides it with a hardcoded `10000`. Fix:

```ts
balance: body.startingBalance ?? 5000
```

No migration needed — the schema default is already correct.

---

## Change 2 — `getPortfolioSummary` Service Method

**File:** `financial-ai-backend/src/simulation/simulation.service.ts`

Add a new method `getPortfolioSummary(userId, accountId): Promise<PortfolioSummary>`.

Steps:
1. Fetch `SimulationAccount` with `positions` included; assert ownership.
2. Fetch all SELL orders for the account; sum `realizedPnL` → `totalRealizedPnL`.
3. Enrich each position with current market price (reuse existing `enrichPosition`).
4. Compute derived fields:
   - `totalInvested` = Σ (avgCost × quantity) across open positions
   - `currentValue` (portfolioValue) = Σ (currentPrice × quantity); positions with null price use avgCost as fallback
   - `unrealizedPnL` = currentValue − totalInvested
   - `totalPnL` = unrealizedPnL + totalRealizedPnL
5. Return a `PortfolioSummary` (type already defined in `simulation.types.ts`).

The `PortfolioSummary` type already has all required fields:
`accountId, name, cashBalance, totalInvested, currentValue, unrealizedPnL, totalRealizedPnL, totalPnL, positions`.

---

## Change 3 — New Route

**File:** `financial-ai-backend/src/simulation/simulation.router.ts`

```
GET /simulation/accounts/:id/summary
```

Calls `simulationService.getPortfolioSummary(req.user.userId, req.params.id)` and returns the result as JSON.

---

---

## Change 4 — Trading History Frontend Component

**New file:** `financial-ai-frontend/src/components/portfolio/TradingHistory.tsx`

A read-only table component placed in the right panel of `dashboard/page.tsx`, below the "My Positions" section.

**Props:** `transactions: Transaction[]` (passed from existing `useSimulationOrders` data — no new API calls)

**Columns:**
| Column | Notes |
|--------|-------|
| Date | `createdAt` formatted as `MMM D, YYYY` |
| Symbol | Plain text |
| Side | BUY/SELL badge (black fill for BUY, outline for SELL) |
| Qty | Numeric |
| Fill Price | USD currency |
| Total | USD currency |
| P&L | SELL orders only — green if ≥ 0, red if < 0; blank for BUY rows |

**Empty state:** "No trades yet" message matching the existing empty-state style.

**Integration:** Import and render `<TradingHistory transactions={transactions} />` in `dashboard/page.tsx` below the positions list. The `transactions` variable is already available on that page.

---

## Out of Scope

- No schema migrations required.
- No changes to existing BUY/SELL/order logic.
- No new API calls for the trading history (reuses existing order fetch).
