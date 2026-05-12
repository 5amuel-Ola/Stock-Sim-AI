# Dashboard Balance, Bought Price, Search, and Trading History — Design Spec

**Date:** 2026-04-28
**Status:** Draft
**Scope:** Improve balance visibility, per-position price clarity, stock search discoverability, and trading-history clarity across the authenticated trading UX

---

## Overview

The current trading UX has four gaps:

1. The dashboard does not clearly show the user's remaining spendable cash from the simulator account.
2. The positions list does not clearly show what price the user bought into each holding at versus what that holding is trading at now.
3. Stock search is ticker-first and exact-match oriented, which forces users to know symbols like `AAPL` or `GME` instead of being able to search by company names such as `Apple` or `Gamestop`.
4. Trading history is currently a single inline table and does not clearly show company names or a clean buy-price-versus-sell-price comparison flow.

This revision adds four product changes:

1. Replace the current `Sentiment` summary card with a new `Balance` card.
2. Make each position show explicit bought-price and current-price information.
3. Upgrade stock search to support company-name matching and return a list of candidate companies with ticker plus company name.
4. Split trading history into a compact dashboard `Mini History` card plus a full `View Trading History` surface with clearer trade details.

The goal is for a user to answer these questions quickly:

- How much cash do I still have left from the starting $5,000?
- What price did I buy this stock at?
- What is this stock trading at right now?
- If I search by company name instead of ticker, can I still find the right stock?
- Can I quickly preview my latest trades and then open a full history that shows what I bought for, what I sold for, and the profit or loss?

---

## Current State

The dashboard already has most of the pricing data needed for the balance and position-display portion of this feature:

- `useSimulationContext()` already returns `balance` from `accountDetails`
- each `Asset` already includes:
  - `quantity`
  - `averageCost`
  - `currentPrice`
- the positions list already calculates:
  - current position value
  - unrealized P&L

The dashboard also currently renders four top summary cards:

- Portfolio Value
- Assets
- Risk Level
- Sentiment

The stock-search flow is more limited:

- `AddAssetModal` currently expects a direct symbol entry
- `StockSearchPanel` uppercases the raw input and performs exact symbol lookup
- current market routes are symbol-based (`/market/stock/:symbol`)
- the UI does not show company names in search results or below owned stock symbols

The trading-history flow is also limited:

- the dashboard currently renders a full inline `TradingHistory` table by default
- that table shows symbols but not company names
- it does not present a compact recent-trades preview card
- it does not explicitly expose a `bought for` versus `sold for` comparison model for completed sells
- the current frontend transaction shape does not carry company names or an explicit per-unit cost-basis field for sell-history rows

So the balance and position-price work is mostly presentation, while the company-name search and improved trading-history work require both UI and API changes.

---

## Bought Price Definition

For this feature, `Bought Price` means the price the user bought into the currently held position at.

In the current simulator accounting model, that should be rendered from the position's stored `averageCost`, because that field represents the effective buy price of the user's remaining holding.

Implications:

- if the user bought the stock once, `Bought Price` is that purchase price
- if the user bought the same stock multiple times, `Bought Price` is the blended cost basis already tracked by the simulator

This matches the user's intent without introducing a new lot-accounting model.

---

## Change 1 — Replace Sentiment With a Balance Card

**File:** `financial-ai-frontend/src/app/dashboard/page.tsx`

### Behavior

- remove the `Sentiment` card from the summary row
- add a new summary card titled `Balance`
- render the current simulator cash balance in USD currency format
- subtitle text should make the purpose explicit, for example:
  - `cash available to spend`
- this card should reflect the remaining cash after BUY orders and after SELL proceeds are applied

### Data Source

Use the existing `balance` value from `useSimulationContext()`.

No new API request is needed.

### Layout

The summary section should remain a four-card row, but with this lineup:

- Portfolio Value
- Balance
- Assets
- Risk Level

No fifth card is needed once `Sentiment` is removed.

### Important Definition

Keep the existing `Portfolio Value` meaning unchanged:

- `Portfolio Value` = current market value of held positions
- `Balance` = unspent cash in the simulator account

Do not silently merge cash into `Portfolio Value` for this feature.

---

## Change 2 — Make Position Pricing and Company Identity Explicit

**File:** `financial-ai-frontend/src/app/dashboard/page.tsx`

### Behavior

For each open position, show explicit pricing and company identity instead of shorthand text.

Each position row should clearly expose:

- the stock `Symbol`
- the `Company Name` in smaller supporting text below the symbol when available
- `Qty`
- `Bought Price`
- `Current Price`

The row should continue to show:

- current total position value
- unrealized P&L
- `Sell` action

### Data Mapping

- `Bought Price` = `averageCost`
- `Current Price` = `currentPrice`
- `Position Value` = `quantity * currentPrice` when `currentPrice` is available
- `Company Name` = resolved security name associated with the ticker symbol

### Fallback Rules

If `currentPrice` is `null`:

- show a neutral fallback label such as `Fetching...` or `Unavailable` for `Current Price`
- keep the existing neutral state for total value if needed
- do not display misleading numeric P&L derived from a missing live price

If `Company Name` cannot be resolved:

- render the symbol normally
- omit the supporting company-name line rather than showing placeholder junk text

### Presentation Direction

The current secondary line:

`2 units · avg $269.69`

should be replaced by a more explicit, scan-friendly format. Example:

`Qty 2 · Bought Price $269.69 · Current Price $213.50`

And the symbol block should support a smaller company-name line, for example:

```text
AAPL
Apple Inc.
```

Equivalent two-line or chip-based layouts are acceptable as long as the labels are explicit and the company name is visually secondary.

---

## Change 3 — Support Company-Name Search With Candidate Results

### Search Behavior

When a user searches for a stock, the search should no longer require exact ticker-symbol knowledge.

The stock search flow should support:

- exact ticker matches
- partial ticker matches
- exact company-name matches
- partial company-name matches
- case-insensitive matching

Examples:

- `apple` should return `AAPL` / `Apple Inc.`
- `gamestop` should return `GME` / `GameStop Corp.`
- `aap` should still surface `AAPL`

### Result Shape

Search should return a candidate list rather than only attempting a single direct quote lookup.

Each result row should show:

- symbol as the primary label
- company name in smaller text underneath
- optional supporting metadata if already available, such as exchange or asset type

### Owned-Stock Behavior

If the user already owns a matched stock:

- that stock must appear in the search results when the company name or symbol matches
- owned matches should sort ahead of otherwise equivalent non-owned matches
- the UI should visually mark them, for example with an `Owned` badge

This satisfies the requirement that if the user searches for a company they already hold, the app should surface their stock instead of forcing them to know the exact symbol.

### Integration Points

This search behavior should apply to the stock-buy/search surfaces that currently rely on exact symbols:

- `financial-ai-frontend/src/components/portfolio/AddAssetModal.tsx`
- `financial-ai-frontend/src/components/market/StockSearchPanel.tsx`

Selecting a candidate should populate the symbol and continue through the existing quote/buy flow.

### API Requirement

The current `/market/stock/:symbol` route is quote lookup, not search.

Add a stock-search API that supports company-name and partial-symbol matching. Example contract:

```ts
GET /market/search?query=apple&type=STOCK
```

Suggested response shape:

```ts
type MarketSearchResult = {
  symbol: string
  companyName: string
  type: 'STOCK'
}
```

Ranking should favor, in order:

1. exact symbol match
2. exact company-name match
3. symbol prefix match
4. company-name prefix match
5. broader partial matches

Owned holdings can then be promoted within that candidate set on the frontend once user positions are known.

### Company Name Source

The backend needs a symbol-reference source for equities that can resolve:

- ticker symbol
- company name

That same metadata source should also be used to render company names below symbols in UI locations where stock identity needs to be clearer.

---

## Change 4 — Add a Mini History Card and Full Trading History View

### Dashboard Mini History Card

Create a compact dashboard card titled `Mini History` in the same main dashboard section as `My Positions`.

Placement intent:

- keep `My Positions` as the primary holdings card
- add `Mini History` as a separate companion card directly below or adjacent to it in the same dashboard content flow
- remove the current always-expanded full trading-history table from the default dashboard view

### Mini History Behavior

The `Mini History` card should show a compact preview of the user's most recent completed trades.

Default scope:

- last 5 filled trades
- reverse chronological order
- BUY and SELL rows included
- open and canceled orders excluded from the mini preview

Each mini-history row should show:

- date
- symbol
- company name in smaller text below the symbol when available
- side (`BUY` or `SELL`)
- quantity
- primary execution price

The mini-history card should include a top-right or bottom CTA button labeled exactly:

`View Trading History`

### Full Trading History Surface

Selecting `View Trading History` should open a full trading-history surface.

Preferred implementation:

- a modal, sheet, or fullscreen overlay launched from the dashboard
- no route change required unless implementation constraints make a dedicated page simpler

The key product requirement is that users can open a dedicated history view without leaving the trading workflow.

### Full History Columns

The full history view should clearly expose:

- `Date`
- `Symbol`
- `Company Name`
- `Side`
- `Qty`
- `Bought Each For`
- `Sold Each For`
- `Profit / Loss`
- `Status`

Column behavior:

- for `BUY` rows:
  - `Bought Each For` = executed buy price
  - `Sold Each For` = `—`
  - `Profit / Loss` = `—`
- for `SELL` rows:
  - `Bought Each For` = cost basis per unit of the sold shares at the time of sale
  - `Sold Each For` = executed sell price
  - `Profit / Loss` = realized P&L for that trade

### Company Names in Trading History

Company names must appear in trading history as well, not just in positions and search results.

Presentation intent:

- symbol remains the primary label
- company name is rendered beneath it in smaller supporting text

Example:

```text
GME
GameStop Corp.
```

### Transaction Data Contract

The current transaction payload already includes:

- symbol
- side
- quantity
- fillPrice
- realizedPnL
- status

The revised history UX needs the transaction response contract to expose additional display-ready data.

Required additions:

```ts
type TransactionHistoryRow = {
  symbol: string
  companyName: string | null
  side: 'BUY' | 'SELL'
  quantity: number
  fillPrice: number | null
  costBasisPerUnit: number | null
  realizedPnL: number | null
  status: 'OPEN' | 'FILLED' | 'CANCELED'
}
```

Notes:

- `companyName` is required for stock display clarity
- `costBasisPerUnit` is required so SELL rows can explicitly show `Bought Each For`
- for BUY rows, `costBasisPerUnit` may equal `fillPrice` or be omitted in favor of frontend mapping to `Bought Each For`

### Derivation Rule for Sell Rows

To keep the UI simple and trustworthy, the backend should return `costBasisPerUnit` explicitly in the order/history response.

If implementation prefers not to persist a new database field, the backend may derive it when building the response contract for filled SELL orders using existing execution data.

The important requirement is that the frontend does not have to guess or improvise the historical buy price for sold shares.

### API Reuse

The existing transactions endpoint should remain the source of truth for both mini history and full history where practical.

Preferred approach:

- mini history uses the same orders endpoint with a small limit and filled-trade filtering
- full history uses the same endpoint with larger limits and pagination support if needed

No separate trading-history backend domain is required unless the current endpoint becomes too awkward to extend.

---

## Change 5 — Preserve Existing Accounting Semantics

The balance and bought/current-price display changes are presentational only.

The stock-search enhancement changes discovery behavior, but it must not change trading or accounting semantics.

The mini-history and full-history changes improve presentation and historical clarity, but they must not change execution or P&L logic.

Do not change:

- BUY balance deduction logic
- SELL proceeds logic
- weighted average cost calculation
- unrealized P&L calculation
- transaction history behavior
- order execution behavior
- price-fetch behavior once a symbol is selected
- realized P&L calculation rules

The dashboard should expose the existing values more clearly, and search should make it easier to discover the correct symbol before trading.

---

## Backend Impact

This revision is split across two scopes:

### No backend changes required for:

- `Balance` card rendering
- `Bought Price` / `Current Price` position rendering

Reason:

- account details already include `balance`
- position payloads already include `avgCost` and `currentPrice`
- frontend `useSimulationContext()` already maps those values into dashboard state

### Backend changes required for:

- company-name search
- candidate result lists
- company-name display under ticker symbols where metadata is not already present
- company-name display in trading-history rows
- explicit history fields for `costBasisPerUnit` on sell-history rows

Reason:

- current market routes are exact symbol lookups
- the current frontend does not have a company-name search dataset
- company-name matching requires a searchable security-reference source
- the current order payload does not include company name
- the current order payload does not expose a display-ready bought-price field for sold trades

---

## Files Changed

| File | Change |
|------|--------|
| `financial-ai-frontend/src/app/dashboard/page.tsx` | Replace `Sentiment` with `Balance`, render company name under symbol, and show explicit `Bought Price` / `Current Price` details for each position |
| `financial-ai-frontend/src/components/portfolio/AddAssetModal.tsx` | Replace exact-symbol-only entry flow with candidate-based stock search UX |
| `financial-ai-frontend/src/components/portfolio/TradingHistory.tsx` | Rework full trading-history presentation to show company names plus `Bought Each For` / `Sold Each For` / `Profit / Loss` columns |
| `financial-ai-frontend/src/components/market/StockSearchPanel.tsx` | Support company-name search and candidate lists with symbol + company name |
| `financial-ai-frontend/src/lib/marketApi.ts` | Add stock-search client method returning candidate matches |
| `financial-ai-frontend/src/lib/types.ts` | Extend transaction and market-search types with company name and history-specific pricing fields |
| `financial-ai-frontend/src/hooks/useSimulation.ts` | Map enriched transaction payloads for mini history and full history rendering |
| `financial-ai-backend/src/market/market.router.ts` | Add stock-search route |
| `financial-ai-backend/src/market/market.service.ts` | Add company-name / partial-symbol search service method |
| `financial-ai-backend/src/simulation/simulation.types.ts` | Extend order/history DTOs with company name and cost-basis-per-unit response fields |
| `financial-ai-backend/src/simulation/...` | Enrich transaction-history responses with company names and sell cost-basis data |

Optional only if the implementation is refactored for readability:

| File | Change |
|------|--------|
| `financial-ai-frontend/src/components/portfolio/...` | Extract a reusable position-row or search-result-row component if the page/modal becomes too dense |
| `financial-ai-frontend/src/components/portfolio/...` | Extract a `MiniHistoryCard` and a dedicated full-history modal/sheet component if that keeps dashboard composition cleaner |

---

## Testing

### Automated

Add or update frontend coverage to verify:

- the dashboard renders a `Balance` card when `balance` is present
- the balance card formats USD correctly
- the dashboard no longer renders the `Sentiment` card
- each position renders explicit `Bought Price` and `Current Price` labels
- company names render below stock symbols when metadata is available
- `Current Price` falls back cleanly when the live price is unavailable
- unrealized P&L does not show a misleading numeric value when no current price exists
- the dashboard renders a `Mini History` card with the latest filled trades
- the mini-history card exposes a `View Trading History` action
- the full-history view shows company names in addition to symbols
- BUY rows show `Bought Each For`
- SELL rows show both `Bought Each For` and `Sold Each For`
- SELL rows show a `Profit / Loss` value derived from realized P&L

Add search coverage to verify:

- searching `apple` returns `AAPL`
- searching `gamestop` returns `GME`
- search results display symbol plus company name
- owned stocks are included and promoted when they match the query
- selecting a candidate continues the existing buy/search flow with the correct symbol

### Manual

1. Register a fresh user and confirm the dashboard shows `Balance` as `$5,000.00` before any buys.
2. Buy one asset and confirm:
   - `Balance` decreases by the executed total cost
  - the position row shows `Bought Price` equal to the stored effective buy price (`averageCost`)
   - the position row shows `Current Price` equal to the latest fetched market price
  - the position row shows the company name under the symbol if metadata is available
3. Buy the same symbol again at a different price and confirm `Buy Price` updates to the weighted average cost basis.
4. Sell part or all of a position and confirm:
  - `Balance` increases appropriately
  - the remaining row still shows the correct weighted `Bought Price`
   - closed positions disappear as they do today
5. Simulate an unavailable market price and confirm the UI shows a neutral current-price fallback instead of misleading numbers.
6. Open the stock-search flow and confirm:
  - searching by ticker still works
  - searching by company name returns candidate companies
  - results show ticker on the main line and company name in smaller text below
  - if the user already owns a matched stock, that result appears and is clearly marked as owned
7. Execute several trades and confirm the dashboard `Mini History` card shows the latest filled trades only.
8. Select `View Trading History` and confirm the full history view shows:
  - company name under the ticker
  - whether the trade was a buy or sell
  - how much the user bought each share/unit for
  - how much the user sold each share/unit for when applicable
  - a profit/loss column for sell rows

---

## Out of Scope

- lot-by-lot purchase history or FIFO/LIFO accounting views
- renaming or redefining `Portfolio Value`
- changing starting balance from $5,000
- redesigning crypto search around company-name semantics
- a separate tax-lot ledger beyond the existing simulator order history
