# Fit-to-Screen Homepage Layout — Design Spec

**Date:** 2026-04-27
**Status:** Draft

---

## Goal

Make the homepage feel balanced and usable at 100% browser zoom on a typical laptop screen, without requiring the user to zoom out to 60% in order to fit the layout on screen.

## Problem Statement

The current landing page uses oversized typography, generous padding, and a tall stacked composition. At normal zoom, the experience feels overwhelming and does not fit cleanly within the viewport.

## Scope

This change applies to the homepage landing layout only.

## Primary Files

- `financial-ai-frontend/src/app/page.tsx`
- `financial-ai-frontend/src/components/chat/AIChatShell.tsx`

## Current Implementation Snapshot

- `page.tsx` currently uses a large landing layout with `min-h-screen`, a `max-w-[1500px]` container, a large serif hero (`text-4xl` to `text-5xl`), and generous spacing.
- The main layout uses `lg:grid-cols-[minmax(320px,520px)_minmax(0,1fr)]`, which makes the left rail visually dominant on common laptop widths.
- The homepage chat wrapper currently uses `min-h-[620px]`, which contributes to a tall first-view composition.
- The feature section is always rendered below the hero/chat area, which pushes the page beyond the first viewport even before the user interacts.

## Design Target

The landing page should work comfortably at 100% browser zoom on common laptop viewports such as:
- 1280x720
- 1366x768
- 1440x900

## Required Layout Changes

- Reduce hero headline size and line height.
- Reduce oversized paddings and gaps.
- Tighten section spacing so the first screen focuses on the hero and chat.
- Keep the chat panel at a viewport-aware height.
- Prevent the feature section from dominating the initial viewport.
- Ensure the layout scales down gracefully on narrower laptop widths.

## Implementation Notes

- This change will not be solved by typography alone; it depends on implementing the fixed chat window and feature reveal changes at the same time.
- Favor `clamp(...)` or breakpoint-based reductions for hero size and spacing instead of a single global downscale.
- The first-screen composition should prioritize header, hero, starter questions, and chat at 1280x720 and 1366x768.
- Login page layout is not part of this spec even though it reuses the anonymous chat shell.

## Responsive Rules

- Desktop keeps hero and chat side by side without oversized proportions.
- Tablet reduces gap, padding, and typography scale.
- Mobile stacks sections vertically while keeping each section compact and readable.

## Acceptance Criteria

- The homepage is usable at 100% browser zoom on a typical laptop.
- The user does not need to zoom out for the page to feel proportionate.
- The hero, starter questions, and chat fit within a balanced first-view layout.
- No major overflow, clipping, or broken spacing appears at standard breakpoints.

## Out of Scope

- No full homepage redesign beyond the current content model.
- No new marketing sections beyond hero, chat, and feature reveal.