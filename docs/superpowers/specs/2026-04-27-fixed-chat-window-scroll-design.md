# Fixed Chat Window Scroll — Design Spec

**Date:** 2026-04-27
**Status:** Draft

---

## Goal

Keep the AI chat inside a fixed visual panel so message history scrolls within the chat window instead of continuously lengthening the entire webpage.

## Problem Statement

The current landing-page chat container grows with conversation length. This stretches the page vertically, makes the layout feel oversized, and weakens the chat-first experience.

## Scope

This change applies to the shared chat shell used by both anonymous and authenticated chat.

## Primary Files

- `financial-ai-frontend/src/app/page.tsx`
- `financial-ai-frontend/src/components/chat/AIChatShell.tsx`

## Current Implementation Snapshot

- `AIChatShell.tsx` already gives the message list `overflow-y-auto`, so the message pane is structurally prepared to scroll.
- The homepage chat wrapper in `page.tsx` currently uses `min-h-[620px] overflow-hidden`, but it does not have a strict viewport-based height cap.
- `page.tsx` also uses `min-h-screen` and renders the feature section below the main grid, so the homepage starts tall before any chat interaction.
- `AIChatShell` is also used on the login page and in the dashboard, so shell-level layout changes propagate beyond the homepage.

## Layout Rules

Desktop behavior:
- The chat container uses a viewport-relative fixed height.
- The header remains visible at the top.
- Quick questions remain visible.
- The message list owns the primary vertical overflow.
- The input stays pinned to the bottom.

Responsive behavior:
- On smaller screens, the chat panel may stack vertically with the rest of the layout.
- Internal scrolling must still be preserved.

## Implementation Notes

- The root cause is primarily the unconstrained parent height on the homepage, not the absence of `overflow-y-auto` in the message list.
- The homepage wrapper should provide an explicit height such as a `vh`-based cap and let `AIChatShell` fill that space.
- If login and dashboard should keep their existing proportions, constrain the homepage wrapper instead of forcing one fixed shell height for every usage site.
- This spec should be implemented alongside the fit-to-screen and feature-reveal changes, because the always-visible feature section also contributes to the oversized first-load page.

## Acceptance Criteria

- Sending multiple messages does not keep increasing total page height.
- The message list becomes scrollable inside the chat panel.
- The input remains visible at the bottom of the chat window.
- The layout remains usable on laptop screens and common mobile widths.

## Out of Scope

- No floating chat widget.
- No separate standalone chat page.