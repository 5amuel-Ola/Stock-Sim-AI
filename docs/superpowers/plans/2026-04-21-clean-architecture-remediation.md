# Clean Architecture Remediation Plan

> For agentic workers: execute sprint-by-sprint, keep behavior stable, and refactor behind tests. Prefer small seams, clear boundaries, and dependency inversion over broad rewrites.

## Goal

Resolve the current architectural risks identified in the GoF QA by moving the project toward a cleaner Uncle Bob style architecture:
- business rules isolated from frameworks and transport
- explicit boundaries between policy and detail
- stable DTOs and interfaces at module edges
- incremental refactors protected by tests
- low-level details depending on abstractions, not the reverse

## Clean Architecture Rules

- Controllers and routers may orchestrate, but not own business rules.
- Services may coordinate use cases, but should not accumulate unrelated responsibilities.
- External APIs, Prisma, OpenAI, Gemini, Yahoo, Alpaca, and browser storage are details behind interfaces.
- New features must land behind tests before refactors widen scope.
- Prefer use-case objects over giant service methods.
- Prefer composition over mode flags when behavior branches by context.
- Keep naming stable across phases unless a rename is explicitly justified.

## Current Issues To Solve

1. `simulation.service.ts` is carrying too many responsibilities.
2. `ai.service.ts` mixes provider setup, prompting, routing, and use-case logic.
3. `api.ts` is an overgrown frontend facade with auth, transport, session, and endpoint concerns mixed together.
4. `AIChatSidebar.tsx` is branching by `mode` and is at risk of becoming a UI god component.
5. `useSimulation.ts` hides fetch orchestration coupling.
6. `market.service.ts` uses type switches instead of a provider strategy boundary.

---

## Phase 1 — Stabilize Boundaries

### Sprint 1: Freeze Current Behavior With Architectural Tests

**Intent:** protect current behavior before deeper refactors.

**Scope**
- Add characterization tests around:
  - simulation trade execution
  - pending order execution
  - AI chat and anonymous cap behavior
  - frontend API error handling and session contract
- Add module-boundary rules in docs and test naming conventions.
  - Done in `docs/superpowers/specs/2026-04-21-sprint-1-conventions.md`.

**Backend tasks**
- [x] Add focused tests around `simulationService.executeTrade` and `processOpenOrders`.
- [x] Add tests proving `SimulationAccountContext` and chat response DTOs stay stable.
- [x] Add tests around `chatAccessService` and auth middleware seams.

**Frontend tasks**
- [x] Add tests around anonymous chat flow, `sessionId` persistence, and `UPGRADE_REQUIRED` handling.
- [x] Add tests around dashboard chat remaining unchanged in simulation mode.

**Exit criteria**
- [x] Behavior is pinned by tests before structural extraction starts.
- [x] No feature regressions.

---

### Sprint 2: Extract Explicit Interfaces For Infrastructure Details

**Intent:** make details replaceable without rewriting use cases.

**Backend tasks**
- [x] Introduce interfaces for:
  - market price provider
  - AI chat provider
  - anonymous usage repository
  - simulation account repository
- [x] Keep Prisma and external SDK calls behind adapters.
- [x] Move direct provider construction out of use-case services.

**Frontend tasks**
- [x] Split `api.ts` into:
  - transport client
  - auth/session policy helpers
  - domain clients (`aiApi`, `simulationApi`, `authApi`, `marketApi`)
- [x] Keep exported method signatures stable for current callers where possible.

**Exit criteria**
- [x] Framework details are behind interfaces.
- [x] Transport and policy no longer live in the same object by default.

---

## Phase 2 — Break Up God Objects

### Sprint 3: Refactor Simulation Into Use Cases + Strategies

**Intent:** replace the giant simulation service center with smaller use-case objects.

**Target design**
- `CreateSimulationAccount`
- `ExecuteTrade`
- `CancelOrder`
- `ProcessOpenOrders`
- `GetOrders`
- `GetPortfolioSummary`
- `GetSimulationAccountContext`

**Pattern direction**
- Use Command-style use cases for each application action.
- Use Strategy objects for order execution rules:
  - market order strategy
  - limit order strategy
  - future stop order strategy
- Keep DTO mapping in dedicated mappers, not inside use-case bodies.

**Tasks**
- [x] Extract order mapping into dedicated mapper module.
- [x] Extract balance/position mutation rules into reusable domain functions.
- [x] Split `executeTrade` by order strategy instead of nested conditionals.
- [x] Split `processOpenOrders` into fetch-open-orders + execute-fill pipeline.

**Exit criteria**
- [x] `simulation.service.ts` is reduced to a facade or removed in favor of use-case exports.
- [x] Adding a new order type no longer requires editing one giant method.

---

### Sprint 4: Refactor AI Layer Into Provider Strategy + Prompt Builders

**Intent:** isolate prompt policy from provider detail.

**Target design**
- `AiChatProvider` interface
- `OpenAiChatProvider`
- `GeminiChatProvider`
- `PromptBuilder` modules for:
  - portfolio chat
  - summary
  - simulation chat
  - structured agents
- optional `AiProviderFactory`

**Tasks**
- [x] Move OpenAI and Gemini SDK initialization into provider adapters.
- [x] Extract prompt construction into dedicated prompt builder modules.
- [x] Keep `aiService` as a thin application facade or replace it with use-case objects.
- [x] Add provider fallback strategy if primary AI provider fails.

**Exit criteria**
- [x] AI use cases depend on provider interfaces, not SDK constructors.
- [x] Prompt changes no longer require editing transport/provider code.

---

## Phase 3 — Clean Frontend Composition

### Sprint 5: Split Frontend API and Session Concerns

**Intent:** separate transport, auth, and domain access.

**Target design**
- `httpClient.ts`
- `auth.ts`
- `apiTransport.ts`
- `chatSession.ts`
- `authApi.ts`
- `aiApi.ts`
- `simulationApi.ts`
- `marketApi.ts`

**Tasks**
- [x] Move request transport into a dedicated client.
- [x] Move 401 handling policy into auth-aware wrapper.
- [x] Move anonymous `sessionId` behavior into chat-specific wrapper.
- [x] Update hooks/components to consume smaller domain APIs.

**Exit criteria**
- [x] API transport no longer owns all app policy.
- [x] Domain API surfaces are smaller and easier to test.

---

### Sprint 6: Decompose Chat UI By Context Instead of Mode Flags

**Intent:** prevent `AIChatSidebar` from becoming a conditional matrix.

**Target design**
- shared presentational chat shell
- `SimulationChatController`
- `AnonymousChatController`
- future `FabChatController`

**Tasks**
- [x] Extract shared rendering into a presentational chat component.
- [x] Move anonymous message-limit logic into anonymous controller layer.
- [x] Move simulation account dependency into simulation controller layer.
- [x] Preserve message model and visual consistency across views.

**Exit criteria**
- [x] No broad `mode === ...` branching in the main chat component.
- [x] New chat variants can be added by composition, not by growing conditionals.

---

### Sprint 7: Normalize Frontend Domain State

**Intent:** make simulation state orchestration explicit.

**Tasks**
- [x] Introduce a `useSimulationContext` or small domain store for current account context.
- [x] Make `useSimulationOrders` consume explicit account context instead of calling `useSimulationAccount` internally.
- [x] Keep SWR usage, but centralize keys and fetch ownership.

**Exit criteria**
- [x] Hook dependencies are explicit.
- [x] Data orchestration is easier to reason about and test.

---

## Phase 4 — Provider Strategy Cleanup

### Sprint 8: Replace Market Type Switching With Provider Registry

**Intent:** finish the market seam properly.

**Target design**
- `MarketDataProvider` interface
- `StockMarketProvider`
- `CryptoMarketProvider`
- `MarketProviderRegistry`

**Tasks**
- [x] Replace `if/else` asset-type switching in `market.service.ts` with provider resolution.
- [x] Keep Yahoo/Gemini/Alpaca behind adapters only.
- [x] Support fallback chains cleanly.

**Exit criteria**
- [x] Adding a new asset/provider does not require editing market orchestration logic heavily.

---

## Phase 5 — Final Hardening

### Sprint 9: Enforce Architecture Rules In CI

**Intent:** stop regression into god objects and mixed responsibilities.

**Tasks**
- [x] Add architecture rule documentation per module.
- [x] Add lint or test guardrails for forbidden imports across boundaries where practical.
- [x] Add CI gates for:
  - backend tests
  - frontend tests
  - backend typecheck
  - frontend typecheck
  - production builds

**Exit criteria**
- [x] Architectural boundaries are documented and checked continuously.

---

## Recommended Sprint Order

1. Sprint 1 — characterization tests
2. Sprint 2 — explicit interfaces
3. Sprint 3 — simulation use cases and order strategies
4. Sprint 4 — AI provider strategy and prompt builders
5. Sprint 5 — frontend API split
6. Sprint 6 — chat UI decomposition
7. Sprint 7 — simulation state normalization
8. Sprint 8 — market provider registry
9. Sprint 9 — CI architecture enforcement

---

## Priority Guidance

If schedule is tight, do these first:
1. Sprint 1
2. Sprint 3
3. Sprint 4
4. Sprint 5

That sequence addresses the highest architectural risk with the least wasted motion.

## Definition of Done Per Sprint

- [ ] Existing behavior preserved or intentionally changed with updated tests.
- [ ] New code depends inward on interfaces and use cases.
- [ ] Mapping logic is not duplicated across layers.
- [ ] Typecheck passes for backend and frontend.
- [ ] Regression tests pass.
- [ ] New seams are documented briefly in the relevant plan/spec.
