# Chat + RBAC Foundation Implementation Plan

> For agentic workers: use task-by-task execution with tests at each step. Keep naming stable across phases.

## Goal

Ship a production-ready chat foundation with:
- Anonymous usage (up to 7 messages)
- Anonymous-to-user conversation carryover on signup/login
- Middleware-based RBAC and menu gating
- Streaming responses (SSE)
- Conversation history per authenticated user
- UI parity between full chat and FAB chat

## Principles

- Keep the same domain variables across backend and frontend: `sessionId`, `conversationId`, `role`, `messageCount`, `isAnonymous`.
- TDD-first for core business logic and middleware.
- Every phase ends with QA + phase-close checklist.
- Production build must compile everything before merge.

---

## Phase 0: Definition + Guardrails (Day 1)

### Deliverables
- One source-of-truth spec for chat state model, auth states, and RBAC roles.
- Acceptance criteria for anonymous cap, carryover, and role enforcement.

### Tasks
- [ ] Define roles: `anonymous`, `user`, `admin`, `tool:restricted`.
- [ ] Define conversation ownership rules:
  - Anonymous conversations keyed by `sessionId`
  - Auth conversations keyed by `userId`
  - On signup/login, migrate anonymous conversation to `userId`
- [ ] Define message cap policy:
  - Max 7 anonymous messages
  - 8th message returns upgrade-required response contract
- [ ] Define API contracts for chat stream, history list, and migration.

### Exit Criteria
- [ ] Spec reviewed and approved.
- [ ] Test matrix drafted for all auth/role permutations.

---

## Phase 1: Backend Foundation (Days 2-4)

### Deliverables
- RBAC middleware in API layer.
- Anonymous cap enforcement.
- Carryover migration endpoint/service.
- SSE stream endpoint for chat responses.

### Tasks
- [ ] Add RBAC middleware package in backend:
  - `requireAuth`
  - `requireRole(...roles)`
  - `requireToolAccess(toolName)`
- [ ] Add anonymous usage tracker service:
  - Increment per anonymous message
  - Reject after 7 with deterministic error code
- [ ] Add conversation migration service:
  - Input: `sessionId`, `userId`
  - Move anonymous messages/conversations to authenticated ownership
  - Idempotent behavior for retries
- [ ] Add SSE endpoint for model streaming and structured events:
  - `message_start`, `token`, `message_end`, `error`
- [ ] Add role-aware menu payload endpoint for frontend.

### Tests (TDD)
- [ ] Unit: cap logic (0..8 boundary), role checks, migration idempotency.
- [ ] Integration: anonymous chat flow, login migration flow, restricted tool denial.
- [ ] Contract: SSE event sequence and reconnect safety.

### Exit Criteria
- [ ] All backend tests pass.
- [ ] No unauthorized role escalation paths.
- [ ] Build passes typecheck + tests.

---

## Phase 2: Frontend Chat Experience (Days 4-6)

### Deliverables
- Hero empty state + suggestion chips.
- Full-screen chat and FAB chat using same state contract.
- Enter behavior toggle (send vs newline).
- Conversation history for logged-in users.

### Tasks
- [ ] Build default hero section for empty chat with CTA chips.
- [ ] Add shared chat state adapter so FAB and full-screen render same message model.
- [ ] Add input mode toggle:
  - Mode A: Enter sends, Shift+Enter newline
  - Mode B: Enter newline, explicit send button
- [ ] Integrate SSE streaming renderer with typing-like output behavior.
- [ ] Add conversation history panel:
  - list, open, rename, delete
  - authenticated users only
- [ ] Add anonymous cap upgrade prompt with sign-up CTA.

### Tests
- [ ] Component tests for input toggle and cap prompt behavior.
- [ ] E2E: anonymous -> signup -> conversation preserved.
- [ ] E2E: role-based menu visibility.

### Exit Criteria
- [ ] UX parity confirmed between FAB and full view.
- [ ] No state divergence in shared chat store.
- [ ] Frontend typecheck + tests pass.

---

## Phase 3: Release Hardening (Days 6-7)

### Deliverables
- Production Docker builds.
- CI gates and QA checklist.
- Incident template using 5 Whys.

### Tasks
- [ ] Add backend and frontend Docker images with health checks.
- [ ] CI pipeline gates:
  - lint
  - typecheck
  - test
  - production build
- [ ] Add QA signoff checklist between phases.
- [ ] Add 5 Whys incident template and link to bug workflow.

### Exit Criteria
- [ ] Clean production build in CI.
- [ ] Smoke-tested in containerized local environment.

---

## API Backlog (Concrete)

- [ ] `POST /api/v1/chat/messages` (non-stream fallback)
- [ ] `GET /api/v1/chat/stream` (SSE)
- [ ] `GET /api/v1/chat/conversations`
- [ ] `POST /api/v1/chat/conversations/migrate-anonymous`
- [ ] `GET /api/v1/menu` (role-aware)

## Data Model Backlog (Concrete)

- [ ] Conversation: `id`, `userId?`, `sessionId?`, `title`, `createdAt`, `updatedAt`
- [ ] Message: `id`, `conversationId`, `role`, `content`, `attachments?`, `createdAt`
- [ ] AnonymousUsage: `sessionId`, `messageCount`, `lastMessageAt`
- [ ] ToolPermission: `role`, `toolName`, `allowed`

## QA Phase-Close Checklist

- [ ] Previous phase regression suite passes.
- [ ] Variable naming unchanged (`sessionId`, `conversationId`, `role`, `messageCount`).
- [ ] Docs/spec updated for any contract change.
- [ ] Known issues logged with owner + target sprint.

## Sprint Recommendation

- Sprint 1: Phase 0 + Phase 1
- Sprint 2: Phase 2 + Phase 3

## First Implementation Slice (start now)

1. Implement anonymous usage counter + 7-message enforcement in backend.
2. Add API contract for upgrade-required response.
3. Add frontend upgrade prompt and lockout on message 8.
4. Add tests for boundary and prompt rendering.
