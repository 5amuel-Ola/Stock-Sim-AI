# Sprint 9 Architecture Guardrails

## Purpose

Sprint 9 turns the refactor outcomes from Sprints 2 through 8 into explicit repository rules.
The goal is to make boundary regressions fail in tests and CI before they turn back into mixed-responsibility modules.

## Backend Module Rules

### AI Module

- `src/ai/ai.service.ts` stays on provider abstractions and prompt builders.
- Only provider adapters may import vendor SDKs directly.
  - `src/ai/openai.provider.ts` owns `openai` imports.
  - `src/ai/gemini.provider.ts` owns `@google/generative-ai` imports.
- Factory and fallback composition belong in `src/ai/ai-provider.factory.ts`, not in routers.

### Market Module

- `src/market/market.service.ts` resolves providers through the registry boundary.
- Upstream clients stay behind `src/market/market.providers.ts`.
- Router and simulation orchestration code may consume `marketService`, but may not import market clients directly.
- Stock latest-price fallback belongs in provider composition, not in route handlers.

### Simulation Module

- `src/simulation/simulation.service.ts` remains a facade over use-case objects.
- Market lookups enter simulation through `marketService` or injected seams, not through direct upstream client imports.

## Frontend Module Rules

### Transport Layer

- `src/lib/httpClient.ts` owns raw fetch behavior and `ApiError`.
- `src/lib/apiTransport.ts` owns JSON headers, optional-auth policy, and 401 redirect behavior.
- Production code outside `src/lib/apiTransport.ts` must not import `httpClient` directly.

### Domain API Layer

- Domain clients in `src/lib` own transport access.
  - `aiApi.ts`
  - `authApi.ts`
  - `marketApi.ts`
  - `portfolioApi.ts`
  - `simulationApi.ts`
- Production code outside the `src/lib` domain API layer must not import `apiTransport` directly.
- Anonymous chat session persistence stays in `src/lib/aiApi.ts` through `chatSession.ts`.

### UI And Hook Layer

- Components and pages consume domain APIs or hooks, not transport primitives.
- Hooks own SWR orchestration and cache-key policy.
- Shared UI shells stay presentational; controller components own mode-specific behavior.

## Enforcement

- Backend architecture audit: `financial-ai-backend/src/test/architecture-boundaries.test.ts`
- Frontend architecture audit: `financial-ai-frontend/src/test/architecture-boundaries.test.ts`
- CI workflow: `.github/workflows/ci.yml`

## Verification Commands

### Backend

```bash
npm test
npm run typecheck
npm run build
```

### Frontend

```bash
npm test
npm run typecheck
npm run build
```