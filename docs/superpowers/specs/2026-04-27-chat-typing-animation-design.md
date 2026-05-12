# Chat Typing Animation — Design Spec

**Date:** 2026-04-27
**Status:** Draft

---

## Goal

Make AI replies feel like they are being written progressively instead of appearing as a fully rendered block all at once.

## Scope

This change applies to both anonymous chat and authenticated simulation chat.

## Primary Files

- `financial-ai-frontend/src/components/chat/AnonymousChatController.tsx`
- `financial-ai-frontend/src/components/chat/SimulationChatController.tsx`
- `financial-ai-frontend/src/components/chat/AIChatShell.tsx`

## Current Implementation Snapshot

- Both chat controllers currently append AI replies in one step using `setConversation(prev => [...prev, { role: 'ai', text: result.reply }])`.
- `AIChatShell.tsx` currently shows a bouncing-dot loading indicator while the network request is in flight.
- Both controllers persist chat history through `chatHistory.save(conversation)` whenever `conversation` changes.
- The shared `chatHistory` helper stores the last 40 display messages under one local storage key: `financial_ai_chat_history_v1`.

## Proposed Behavior

- The user message appears immediately.
- After the backend response returns, an AI message placeholder appears immediately.
- The AI reply is progressively revealed character by character.
- The message panel auto-scrolls as the reply grows.
- Input stays disabled while the reply is actively being revealed.

## Implementation Notes

- This iteration does not require provider-level streaming.
- The frontend may fetch the full reply in one request and animate the reveal locally.
- Punctuation may use slightly longer pauses for a more natural rhythm, but the animation must still complete quickly enough for normal use.
- Because both controllers duplicate the send flow today, a shared helper or hook is preferred over implementing typing logic twice.
- A naive character-by-character `setConversation` loop will trigger `chatHistory.save()` on every tick. The implementation should either persist only the final message text or debounce local storage writes.
- `AIChatShell` autoscroll currently depends on `messages` changes; the typing implementation must keep the message list scrolling as the visible text grows.
- The bouncing-dot loader should transition cleanly into the animated AI message without producing a second AI bubble.

## Acceptance Criteria

- AI replies no longer appear all at once.
- The typing animation works in both anonymous and authenticated chat.
- The message list remains readable during progressive rendering.
- There is no duplicate final message after the animation completes.

## Out of Scope

- No SSE, WebSocket, or true token streaming requirement.
- No provider API change.