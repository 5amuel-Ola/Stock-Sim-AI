# Sprint 1 Conventions

## Purpose

Sprint 1 freezes current behavior before structural refactors begin.
These conventions define which seams must be pinned by tests and how those tests should be named so later Sprint 2 extractions can move internals without changing externally visible behavior.

## Module-Boundary Rules

1. Test the owning seam, not the implementation detail behind it.
   - HTTP contract behavior belongs in router or request tests.
   - Browser interaction behavior belongs in component tests.
   - Transport and session policy behavior belongs in API-client tests.

2. Freeze mode-based branching at the first public boundary.
   - Anonymous versus authenticated chat belongs at the HTTP seam.
   - Simulation versus anonymous chat belongs at the UI seam.

3. Protect DTOs where modules hand structured data to another layer.
   - Account context DTOs must be asserted as serialized shapes, not inferred from internal types.
   - Chat response metadata must be asserted by fields that callers actually consume.

4. Characterization tests must assert observable outcomes only.
   - Request path, headers, payload shape, response shape, user-visible text, and error codes are valid.
   - Internal helper calls are only asserted when they define the seam being frozen.

5. Do not widen a characterization test into a refactor test.
   - One seam, one behavior slice, one regression target.
   - If a second seam matters, add a second test file or a second test case.

## Test Naming Conventions

- Name the describe block after the boundary under test.
  - Examples: `POST /api/v1/ai/chat`, `simulationService.getAccountForAIContext`, `AIChatSidebar mode behavior`.

- Name each test after the observable contract it freezes.
  - Preferred verbs: `uses`, `forwards`, `persists`, `returns`, `blocks`, `ignores`, `renders`, `keeps`.

- Avoid naming tests after implementation details.
  - Prefer `uses the authenticated simulation route` over `calls request helper with simulation path`.

- When a mode or policy branch is the point of the test, include that branch in the name.
  - Example: `uses simulationChat and omits anonymous UI state in simulation mode`.

## Sprint 1 Protected Seams

- Backend simulation execution and pending-order processing.
- Backend anonymous chat access and optional-auth handling.
- Backend DTO stability for `SimulationAccountContext`.
- Frontend API session persistence and `UPGRADE_REQUIRED` handling.
- Frontend `AIChatSidebar` mode split between simulation and anonymous chat.

## Done Criteria For Sprint 1 Tests

- A failing characterization test should indicate a contract regression, not an internal refactor.
- A passing characterization suite should allow Sprint 2 interface extraction without changing endpoint names, payload keys, mode behavior, or session semantics.