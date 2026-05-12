# Short Clean AI Replies — Design Spec

**Date:** 2026-04-27
**Status:** Draft

---

## Goal

Make AI chat responses shorter, easier to scan, and free of markdown artifacts such as asterisks.

## Problem Statement

The current chat prompt allows long, dense replies, and the raw text can surface markdown-like emphasis markers such as `**`. This creates oversized answer blocks that are hard to scan inside the chat UI.

## Scope

This change applies to both general anonymous chat and authenticated simulation chat.

## Primary Files

- `financial-ai-backend/src/ai/portfolio.prompt-builder.ts`
- `financial-ai-backend/src/ai/simulation.prompt-builder.ts`
- `financial-ai-frontend/src/components/chat/AnonymousChatController.tsx`
- `financial-ai-frontend/src/components/chat/SimulationChatController.tsx`

## Current Implementation Snapshot

- General anonymous chat uses `portfolioPromptBuilder.buildChatMessages(...)` in `financial-ai-backend/src/ai/ai.service.ts`.
- The current portfolio chat prompt asks for clear, practical answers but does not impose a word cap or explicitly forbid markdown formatting.
- Simulation chat already has stricter prompt guidance in `simulation.prompt-builder.ts`, including a `under 120 words` rule and a direct-action recommendation, but it still does not explicitly forbid markdown markers.
- `ai.service.ts` returns raw provider text for both `chat()` and `simulationChat()`.
- `openai.provider.ts` and `gemini.provider.ts` both return raw chat strings with no cleanup.
- Only Gemini structured JSON responses strip code fences today; normal chat responses do not.

## Backend Requirements

Update chat prompt instructions so the assistant defaults to:
- concise answers
- direct recommendation first when appropriate
- short paragraphs or short bullets
- plain language
- no markdown syntax
- no bold markers
- no unnecessary headings
- no disclaimer-heavy lead-in

Default response length guidance:
- simple questions: 2 to 4 short sentences
- list-style questions: up to 4 short bullets
- deeper detail only when the user explicitly asks for it

## Implementation Notes

- The root-cause fix belongs in the prompt builders, not just the UI.
- The portfolio chat prompt needs the larger rewrite because it is currently the least constrained.
- The simulation prompt only needs a smaller adjustment to add no-markdown formatting and reinforce concise presentation.
- A lightweight sanitizer should still be applied once before rendering, because the provider layer currently returns raw text and model compliance will not be perfect.
- The sanitizer must avoid damaging stock tickers, percentages, or currency text while stripping markdown emphasis markers and code fences.

## Frontend Safeguard

Add a lightweight cleanup step before rendering chat replies:
- strip `**`, stray `*`, and code fences
- preserve normal sentence spacing and plain line breaks
- keep rendering as plain text rather than rich markdown

## Acceptance Criteria

- Common replies are materially shorter than the current output.
- Markdown artifacts are not visible in the chat window.
- Replies are easier to scan inside the fixed-height chat panel.
- Users can still request more detail explicitly.

## Out of Scope

- No rich markdown renderer.
- No HTML response formatting.