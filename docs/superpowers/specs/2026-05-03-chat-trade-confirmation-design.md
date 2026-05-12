# Chat Trade Confirmation Flow — Design Spec
_Date: 2026-05-03_

## Overview

Enable authenticated simulation users to place BUY and SELL market trades directly from the dashboard chat.
The chat must never execute a trade on the first intent message.
The chat must first return a structured trade proposal with estimated price, estimated total, and projected balance impact.
The user must then explicitly confirm or cancel the proposal from the chat UI.
Only after confirmation may the backend execute the trade.
After execution, the chat must report the actual fill price, total spent or received, realized P&L for sells when applicable, and the updated account balance.

This extends the existing authenticated simulation chat and existing simulation trade engine.
No new trade execution rules are introduced.
All fund checks, position checks, and live market pricing continue to be enforced by the current simulation service.

---

## Product Behavior

### Supported user intents

The chat should recognize direct trade intents such as:
"Buy 10 AAPL."
"Sell 4 shares of AAPL."
"Buy 2 BTC."

The first release only supports explicit quantity-based market orders from authenticated simulation chat.
The first release does not support limit orders from chat.
The first release does not support ambiguous requests such as "buy some Apple" or "sell half my position".

### Required flow

1. The user sends a trade request in authenticated simulation chat.
2. The backend detects a valid BUY or SELL trade intent.
3. The backend fetches a current market price estimate for the requested symbol.
4. The backend validates the request enough to produce a proposal preview.
5. The backend returns a structured trade proposal instead of executing the trade.
6. The frontend renders the proposal inside the chat transcript with `Confirm` and `Cancel` actions.
7. If the user confirms, the frontend calls a dedicated confirm endpoint.
8. The backend executes the trade through the existing simulation trade service.
9. The backend returns execution details and the refreshed account balance.
10. The frontend renders a completion message in the transcript.

### User-facing response rules

For a BUY confirmation prompt, the chat must show:
The symbol.
The quantity.
The estimated market price per unit.
The estimated total cost.
The projected balance after the trade.
Any warnings returned by risk or validation checks.

For a SELL confirmation prompt, the chat must show:
The symbol.
The quantity.
The estimated market price per unit.
The estimated total proceeds.
The projected balance after the trade.
If available, the held quantity or average cost context.

For a completed BUY, the chat must show:
The actual fill price.
The actual total spent.
The updated cash balance.

For a completed SELL, the chat must show:
The actual fill price.
The actual total received.
The realized P&L if present.
The updated cash balance.

---

## Scope

### In scope

Authenticated simulation chat only.
BUY and SELL market trades only.
Proposal plus confirmation flow in chat.
Structured chat responses for trade proposals and completed executions.
Explicit confirm and cancel actions rendered in the chat UI.
Updated tests for chat trade proposal, confirmation, cancellation, and error handling.

### Out of scope

Anonymous chat trading.
Limit orders from chat.
Natural language portfolio operations beyond direct buy or sell commands.
Voice commands.
Multi-account trade routing.
Free-form textual confirmation parsing as the only confirmation mechanism.

---

## Existing Surfaces To Reuse

The current authenticated simulation chat entry point is [financial-ai-backend/src/simulation/simulation.router.ts](financial-ai-backend/src/simulation/simulation.router.ts#L58).
The current simulation trade execution path is [financial-ai-backend/src/simulation/simulation.router.ts](financial-ai-backend/src/simulation/simulation.router.ts#L30) and [financial-ai-backend/src/simulation/simulation.service.ts](financial-ai-backend/src/simulation/simulation.service.ts#L28).
The current frontend simulation chat controller is [financial-ai-frontend/src/components/chat/SimulationChatController.tsx](financial-ai-frontend/src/components/chat/SimulationChatController.tsx#L14).
The current frontend chat shell is [financial-ai-frontend/src/components/chat/AIChatShell.tsx](financial-ai-frontend/src/components/chat/AIChatShell.tsx#L25).
The current frontend simulation API client is [financial-ai-frontend/src/lib/simulationApi.ts](financial-ai-frontend/src/lib/simulationApi.ts#L1).

The implementation must reuse the existing trade engine rather than duplicating execution logic in the AI layer.
The AI layer may propose a trade and generate text around it.
The simulation service remains the source of truth for whether a trade succeeds or fails.

---

## Approach

### Chosen approach

Add a structured response envelope to simulation chat.
Add proposal and execution payload types to the backend and frontend.
Detect direct trade intents inside the simulation chat route or a dedicated simulation chat orchestration helper.
Return a trade proposal object for valid direct trade requests.
Render the proposal as a chat card with `Confirm` and `Cancel` buttons.
Execute confirmation through a dedicated confirm endpoint that delegates to the existing simulation trade service.

### Why this approach

It preserves the existing chat UX while adding a safe transactional step.
It avoids allowing the LLM to directly mutate portfolio state.
It keeps validation, market price lookup, and balance updates in one place.
It gives the frontend a typed contract for chat actions rather than forcing brittle text parsing.

---

## Backend Design

### Change 1 — Expand simulation chat response types

**File:** `financial-ai-backend/src/ai/ai.types.ts`

Replace the current single-shape simulation chat response with a discriminated union.

```ts
export interface TradeProposal {
  proposalId: string
  side: 'BUY' | 'SELL'
  symbol: string
  type: 'STOCK' | 'CRYPTO'
  quantity: number
  estimatedPrice: number
  estimatedTotal: number
  projectedBalanceAfter: number
  warnings: string[]
}

export interface TradeExecutionSummary {
  side: 'BUY' | 'SELL'
  symbol: string
  type: 'STOCK' | 'CRYPTO'
  quantity: number
  fillPrice: number
  totalValue: number
  realizedPnL: number | null
  balanceAfter: number
}

export type SimulationChatResponse =
  | { kind: 'message'; reply: string }
  | { kind: 'trade_proposal'; reply: string; proposal: TradeProposal }
  | { kind: 'trade_executed'; reply: string; execution: TradeExecutionSummary }
```

This keeps normal chat replies working while allowing trade-specific payloads.

### Change 2 — Add trade intent parsing for simulation chat

**New file or extracted helper:** `financial-ai-backend/src/ai/simulation-trade-intent.ts`

Add a small parser for direct market trade requests.
The parser only needs to support clear, high-confidence commands.
The parser should extract:
`side`, `symbol`, `quantity`, and inferred `type`.

Accepted examples:
`buy 10 aapl`
`sell 4 shares of aapl`
`buy 2 btc`

Rejected examples should fall back to normal AI chat behavior.
If the parser is not confident, do not create a proposal.

### Change 3 — Add simulation chat orchestration

**File:** `financial-ai-backend/src/simulation/simulation.router.ts`

The current `POST /accounts/:id/ai/chat` route directly calls `aiService.simulationChat(...)`.
Change this route so it first checks for a direct trade intent.

Flow:
1. Load account context.
2. Parse the incoming message.
3. If the message is not a direct trade intent, keep the existing AI chat path.
4. If the message is a valid trade intent, fetch a market price estimate.
5. Perform proposal-level validation.
6. Return `kind: 'trade_proposal'` with a typed proposal payload.

Proposal-level validation must include:
For BUY, reject proposals that obviously exceed available balance.
For SELL, reject proposals that exceed the user’s held quantity.
If the symbol price cannot be fetched, return the same market price unavailable error behavior used by trade execution.

### Change 4 — Add confirm endpoint

**File:** `financial-ai-backend/src/simulation/simulation.router.ts`

Add a new endpoint:

```ts
POST /simulation/accounts/:id/ai/trade/confirm
```

Request body:

```ts
{
  proposal: {
    side: 'BUY' | 'SELL'
    symbol: string
    type: 'STOCK' | 'CRYPTO'
    quantity: number
  }
}
```

Server behavior:
1. Validate the confirm payload with Zod.
2. Delegate directly to `simulationService.executeTrade(...)` using `orderType: 'MARKET'`.
3. Re-fetch the account after execution.
4. Return a `trade_executed` payload with actual fill values and updated balance.

The confirm endpoint must not trust any estimated price from the proposal.
Execution must always use current live price lookup from the existing trade engine.

### Change 5 — Add cancel behavior

No new backend endpoint is required for cancel in the first release.
Cancel is a frontend-only action that marks the proposal as dismissed in the transcript.
No server mutation occurs on cancel.

### Change 6 — Optional prompt adjustment

**File:** `financial-ai-backend/src/ai/simulation.prompt-builder.ts`

Keep the existing simulation prompt for analysis questions.
Add one instruction that if the request is a direct trade command, orchestration outside the prompt handles the execution flow.
This prevents the AI text response from fighting the typed proposal flow.

---

## Frontend Design

### Change 1 — Expand chat message model

**File:** `financial-ai-frontend/src/components/chat/chat.types.ts`

Extend `ChatDisplayMessage` so an assistant message can carry a proposal or execution payload.

```ts
export interface ChatTradeProposal {
  proposalId: string
  side: 'BUY' | 'SELL'
  symbol: string
  type: 'STOCK' | 'CRYPTO'
  quantity: number
  estimatedPrice: number
  estimatedTotal: number
  projectedBalanceAfter: number
  warnings: string[]
}

export interface ChatTradeExecution {
  side: 'BUY' | 'SELL'
  symbol: string
  type: 'STOCK' | 'CRYPTO'
  quantity: number
  fillPrice: number
  totalValue: number
  realizedPnL: number | null
  balanceAfter: number
}

export interface ChatDisplayMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  proposal?: ChatTradeProposal
  execution?: ChatTradeExecution
}
```

### Change 2 — Expand simulation API client

**File:** `financial-ai-frontend/src/lib/simulationApi.ts`

Update `simulationChat(...)` to return the discriminated union from the backend.
Add `confirmChatTrade(accountId, proposal)` to call the new confirm endpoint.

```ts
confirmChatTrade(accountId: string, proposal: {
  side: 'BUY' | 'SELL'
  symbol: string
  type: 'STOCK' | 'CRYPTO'
  quantity: number
})
```

### Change 3 — Render trade proposal cards in chat

**Files:**
`financial-ai-frontend/src/components/chat/SimulationChatController.tsx`
`financial-ai-frontend/src/components/chat/AIChatShell.tsx`

When chat receives `kind: 'trade_proposal'`, append an assistant message containing both the reply text and the proposal payload.
Render a proposal card below the assistant text.
The card should include:
Side.
Symbol.
Quantity.
Estimated price.
Estimated total.
Projected balance after trade.
Warnings if any.
`Confirm` button.
`Cancel` button.

`Confirm` should:
Disable both actions while the request is in flight.
Call `simulationApi.confirmChatTrade(...)`.
Append the returned executed-trade assistant message.
Trigger portfolio and order refresh.

`Cancel` should:
Disable further actions on that proposal message.
Optionally append a short assistant or system-style message such as `Trade canceled.`

### Change 4 — Refresh dashboard data after execution

**File:** `financial-ai-frontend/src/components/chat/SimulationChatController.tsx`

After a confirmed trade succeeds, refresh:
The simulation account context.
The simulation orders list.

The existing dashboard surfaces should update automatically once those SWR caches are mutated.

### Change 5 — Preserve transcript compatibility

**File:** `financial-ai-frontend/src/lib/simulationChatHistory.ts`

Update storage normalization so messages with `proposal` or `execution` payloads can be saved and restored.
Old text-only chat history must continue to load without migration errors.

---

## API Contract

### `POST /simulation/accounts/:id/ai/chat`

#### Normal analytical reply

```json
{
  "kind": "message",
  "reply": "AAPL still fits a growth-heavy simulation account, but your concentration matters."
}
```

#### Trade proposal reply

```json
{
  "kind": "trade_proposal",
  "reply": "I can place that trade. Review the estimate below and confirm if you want to proceed.",
  "proposal": {
    "proposalId": "proposal_123",
    "side": "BUY",
    "symbol": "AAPL",
    "type": "STOCK",
    "quantity": 10,
    "estimatedPrice": 189.42,
    "estimatedTotal": 1894.2,
    "projectedBalanceAfter": 3105.8,
    "warnings": []
  }
}
```

### `POST /simulation/accounts/:id/ai/trade/confirm`

#### Request

```json
{
  "proposal": {
    "side": "BUY",
    "symbol": "AAPL",
    "type": "STOCK",
    "quantity": 10
  }
}
```

#### Response

```json
{
  "kind": "trade_executed",
  "reply": "Bought 10 shares of AAPL.",
  "execution": {
    "side": "BUY",
    "symbol": "AAPL",
    "type": "STOCK",
    "quantity": 10,
    "fillPrice": 189.37,
    "totalValue": 1893.7,
    "realizedPnL": null,
    "balanceAfter": 3106.3
  }
}
```

---

## Validation Rules

The proposal step must reject invalid trades before showing a confirmation card.
The confirm step must still rely on the existing trade engine as the final authority.

### BUY proposal checks

Quantity must be positive.
The symbol must resolve to a price.
Estimated total must not exceed current cash balance.

### SELL proposal checks

Quantity must be positive.
The symbol must resolve to a price.
The account must currently hold the asset.
Requested quantity must not exceed held quantity.

### Confirm-time checks

All normal execution rules still apply.
A trade can still fail at confirm time if the market price changes enough to make funds insufficient or if the state changed between proposal and confirmation.
The confirm response must surface those existing errors clearly in chat.

---

## Error Handling

If the trade intent is ambiguous, fall back to normal AI chat instead of forcing a proposal.
If the market price cannot be fetched, return the existing `MARKET_PRICE_UNAVAILABLE` failure.
If a BUY exceeds funds, show the existing insufficient funds messaging in chat.
If a SELL exceeds holdings, show the existing insufficient position messaging in chat.
If the confirm step fails, keep the original proposal card visible but mark it as unresolved or expired.

---

## Testing

### Backend tests

Add route tests for `POST /simulation/accounts/:id/ai/chat` to verify:
A normal analytical question still returns `kind: 'message'`.
A direct BUY request returns `kind: 'trade_proposal'` with the correct payload.
A direct SELL request returns `kind: 'trade_proposal'` with the correct payload.
An over-budget BUY request returns the expected error.
An oversize SELL request returns the expected error.

Add route tests for `POST /simulation/accounts/:id/ai/trade/confirm` to verify:
A confirmed BUY executes and returns actual fill price plus updated balance.
A confirmed SELL executes and returns actual fill price plus updated balance.
Realized P&L is returned for SELL when applicable.
Execution failures are surfaced correctly.

### Frontend tests

Add component tests for `SimulationChatController` to verify:
A proposal response renders a proposal card.
Clicking `Confirm` calls the confirm API and appends an execution message.
Clicking `Cancel` dismisses the proposal without network mutation.
Portfolio and transaction refresh callbacks are triggered after successful execution.

Add persistence tests to verify:
Chat history with proposal payloads reloads safely.
Old text-only messages still deserialize correctly.

---

## Implementation Notes

The first release should use button-based confirmation rather than natural-language `yes` parsing.
This avoids ambiguity when multiple trade ideas appear in the same transcript.
The first release should keep trade proposal parsing rule-based rather than LLM-decided.
This keeps the execution trigger predictable and testable.
The first release should use the actual execution result from `simulationService.executeTrade(...)` for user-facing totals.
Estimated values from the proposal must never be shown as if they were final fills.

---

## Files Expected To Change

| File | Change |
|------|--------|
| `financial-ai-backend/src/ai/ai.types.ts` | Expand simulation chat response and add trade proposal or execution types |
| `financial-ai-backend/src/simulation/simulation.router.ts` | Add simulation chat orchestration and confirm endpoint |
| `financial-ai-backend/src/ai/simulation.prompt-builder.ts` | Minor prompt guardrails for orchestration-aware behavior |
| `financial-ai-backend/src/test/simulation.test.ts` | Add backend tests for proposal and confirmation flows |
| `financial-ai-frontend/src/components/chat/chat.types.ts` | Add proposal and execution payloads to chat messages |
| `financial-ai-frontend/src/lib/simulationApi.ts` | Add richer simulation chat typing and confirm trade call |
| `financial-ai-frontend/src/components/chat/SimulationChatController.tsx` | Handle proposal and confirm or cancel state transitions |
| `financial-ai-frontend/src/components/chat/AIChatShell.tsx` | Render proposal and execution cards and confirm or cancel actions |
| `financial-ai-frontend/src/lib/simulationChatHistory.ts` | Persist structured chat payloads safely |
| `financial-ai-frontend/src/test/...` | Add frontend interaction and persistence coverage |

---

## Acceptance Criteria

An authenticated user can type `Buy 10 AAPL` into simulation chat and receive a confirmation card instead of immediate execution.
Confirming the card executes the trade through the existing simulation service.
The follow-up assistant message shows actual fill price, actual total spent or received, and updated balance.
Canceling the card performs no trade.
The dashboard positions and trading history update after successful confirmation.
Normal analytical chat questions continue to work unchanged.