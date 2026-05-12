# Shared Anonymous Message Budget — Design Spec

**Date:** 2026-04-27
**Status:** Draft

---

## Goal

Ensure every anonymous chat entry point consumes the same remaining-message budget so the product behaves like one unified anonymous chat experience.

## Problem Statement

The backend already enforces a single anonymous usage limit, but the homepage exposes multiple question entry points. From the user's perspective, starter questions, quick questions, and typed messages must all reduce the same visible count.

## Scope

This change applies to anonymous chat only.

## Primary Files

- `financial-ai-frontend/src/app/page.tsx`
- `financial-ai-frontend/src/components/chat/AIChatSidebar.tsx`
- `financial-ai-frontend/src/components/chat/AnonymousChatController.tsx`
- `financial-ai-backend/src/ai/anonymous-usage.service.ts`
- `financial-ai-backend/src/ai/chat-access.service.ts`

## Current Implementation Snapshot

- The backend anonymous limit is already centralized in `financial-ai-backend/src/ai/anonymous-usage.service.ts` via `ANONYMOUS_MESSAGE_LIMIT = 7`.
- `chatAccessService.evaluate()` increments usage for every anonymous `/ai/chat` request and returns `messageCount` and `remainingMessages`.
- In the frontend, starter questions already route through `AnonymousChatController.send()` using the `starterPrompt` prop, so they already consume the same backend budget as typed messages.
- The current implementation gap is in UI state sharing, not backend enforcement.
- `AIChatShell.tsx` defines quick questions as a local `SUGGESTIONS` constant and disables them only through `inputDisabled`.
- Homepage starter-question buttons live in `page.tsx` and currently do not receive `loading`, `remainingMessages`, or `upgradeRequired` state from `AnonymousChatController`.
- `remainingMessages` is initialized to `7` on mount in `AnonymousChatController` and is not persisted across reloads.
- Anonymous session identity is persisted in local storage under the `financial_ai_chat_session_id` key in `src/lib/chatSession.ts`.

## Product Rule

Each of the following actions counts as one anonymous message:
- clicking a starter question in the hero
- clicking a quick question in the chat shell
- submitting a typed message manually

All three actions must use the same send path and consume the same remaining-message budget.

## UI Requirements

- The anonymous badge must show one authoritative remaining-message count.
- Starter-question buttons and quick-question buttons must be disabled when the anonymous limit is exhausted.
- Manual input must also be disabled when the limit is exhausted.
- The upgrade CTA must appear consistently regardless of which entry point triggered the last allowed message.

## Backend Requirements

- The current anonymous usage service remains the source of truth for enforcement.
- The frontend treats `remainingMessages` returned from the API as authoritative.
- No schema change or new route is required.

## Implementation Notes

- `AnonymousChatController` should expose enough state back to `page.tsx` so starter-question buttons can be disabled during loading and when the anonymous limit is exhausted.
- Quick questions and starter questions should either share one exported constant or be passed as props from a shared source so they do not diverge over time.
- If product requirements later demand an accurate remaining count immediately after page refresh, the current codebase does not have a read-only endpoint for that; the count would need to be persisted client-side or fetched through a new API.

## Acceptance Criteria

- Sending from any anonymous entry point decrements the same visible counter.
- The remaining count updates immediately after any successful anonymous reply.
- Once the limit is reached, starter questions, quick questions, and manual input all stop accepting new prompts.
- The user receives a consistent upgrade path to login/register.

## Out of Scope

- No change to the anonymous limit value.
- No separate allowance for starter questions.