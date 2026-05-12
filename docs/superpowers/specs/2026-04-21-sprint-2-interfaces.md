# Sprint 2 Interface Extraction Notes

## Intent

Sprint 2 extracts infrastructure details behind explicit interfaces while preserving the behavioral contracts frozen in Sprint 1.

## Backend Boundaries

- `market.service.ts` now depends on `MarketDataProvider` adapters instead of concrete SDK clients.
- `ai.service.ts` now depends on an `AiProvider` adapter instead of constructing the OpenAI SDK directly.
- anonymous chat usage now flows through `AnonymousUsageRepository` before touching Prisma.
- simulation persistence now flows through `SimulationAccountRepository` before touching Prisma transactions and records.

## Frontend Boundaries

- `httpClient.ts` owns raw transport and error parsing.
- `apiTransport.ts` owns auth-aware request policy and 401 handling.
- `authApi.ts`, `aiApi.ts`, `simulationApi.ts`, `marketApi.ts`, and `portfolioApi.ts` own domain-specific request surfaces.
- `api.ts` remains a compatibility facade so existing Sprint 1 callers keep the same import path and method names.

## Consistency Rules

- Preserve the `api` facade shape used by current hooks and components.
- Preserve `ApiError` as the error type consumed by chat and trading UI flows.
- Keep anonymous session persistence behavior unchanged from Sprint 1 tests.
- Keep simulation and AI service method names stable while redirecting dependencies through adapters.