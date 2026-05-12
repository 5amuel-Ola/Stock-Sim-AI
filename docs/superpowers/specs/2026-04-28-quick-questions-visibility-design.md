# Authenticated Quick Questions Visibility — Design Spec

**Date:** 2026-04-28
**Status:** Approved
**Scope:** Refine authenticated chat presentation in `financial-ai-frontend`

---

## Overview

Authenticated chat currently keeps the quick-question suggestion block visible even after the user has already started a conversation.

This change makes quick questions a first-use affordance only:
1. Show quick questions before the user sends the first authenticated message
2. Hide quick questions after the conversation has started
3. Keep anonymous chat behavior unchanged

The goal is to reduce vertical noise once the user is actively chatting with the AI.

---

## Approach

**Option A — Derive visibility from existing conversation state.**

- Do not add new UI state or persistence keys
- Use the authenticated conversation array as the source of truth
- Hide quick questions as soon as at least one user-authored message exists in the authenticated chat history

This approach is deterministic and survives reload/hydration because the chat history already persists.

---

## Section 1: Visibility Rule

Quick questions render only while the authenticated simulation chat has no user messages.

Rule:

```ts
showSuggestions = !conversation.some(message => message.role === 'user')
```

Implications:

- first authenticated render with no prior history: suggestions visible
- after first user send: suggestions hidden immediately
- hydrated sessions with prior user messages: suggestions remain hidden
- anonymous chat remains unchanged and still suppresses quick questions entirely

---

## Section 2: Scope Boundary

This change belongs in the authenticated simulation chat controller, not in the shell.

Reasoning:

- `AIChatShell` is a presentational component
- the controller already owns the authenticated conversation state
- the controller can decide whether suggestions should be rendered without introducing duplicate state higher up

---

## Files Changed

| File | Change |
|------|--------|
| `financial-ai-frontend/src/components/chat/SimulationChatController.tsx` | Derive `showSuggestions` from user-message history |
| `financial-ai-frontend/src/components/chat/AIChatFacade.test.tsx` | Add regression coverage for quick questions disappearing after first authenticated send |

---

## Non-Goals

- No anonymous chat behavior changes
- No change to suggestion text
- No change to chat history persistence format
- No change to chat send flow or AI API behavior

---

## Testing

- Add a regression assertion that authenticated quick questions are visible before the first send
- Assert they disappear after the first authenticated user message is submitted
- Re-run the existing chat facade suite to ensure no mode or persistence regressions