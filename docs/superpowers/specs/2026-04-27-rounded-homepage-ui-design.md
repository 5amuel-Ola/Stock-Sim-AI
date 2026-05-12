# Rounded Homepage UI — Design Spec

**Date:** 2026-04-27
**Status:** Draft

---

## Goal

Replace the current sharp-cornered homepage and chat surfaces with a consistent rounded visual style that feels lighter and more modern without changing the overall structure or brand tone.

## Scope

Apply rounded corners to the main landing-page surfaces and shared chat shell:
- top header container
- hero panel
- starter-question cards
- chat container
- quick-question buttons
- chat message bubbles
- feature cards
- buttons and input fields

## Primary Files

- `financial-ai-frontend/src/app/page.tsx`
- `financial-ai-frontend/src/components/chat/AIChatShell.tsx`
- `financial-ai-frontend/src/components/chat/AnonymousChatController.tsx`
- `financial-ai-frontend/src/components/chat/SimulationChatController.tsx`

## Current Implementation Snapshot

- `financial-ai-frontend/src/app/page.tsx` defines the landing-page header, hero panel, starter-question cards, chat wrapper, and feature cards directly with Tailwind utility classes.
- The current homepage surfaces use bordered boxes with no `rounded-*` classes.
- `financial-ai-frontend/src/components/chat/AIChatShell.tsx` renders the shared chat chrome for both anonymous and simulation chat. Its quick-question buttons, message bubbles, form, and footer are all square-cornered today.
- `financial-ai-frontend/src/components/chat/AIChatSidebar.tsx` routes both anonymous and simulation modes through the same shell, so shell styling changes propagate to the homepage, login page, and dashboard left panel.

## Design Rules

- Large panels use a larger shared radius such as `rounded-2xl`.
- Cards and feature boxes use a medium shared radius such as `rounded-xl`.
- Buttons and inputs use a smaller shared radius such as `rounded-lg`.
- User and AI chat bubbles may use slightly different corner treatment, but both must be visibly rounded.
- Hover, active, and focus states must preserve the rounded silhouette.

## Implementation Notes

- There is no shared homepage card or button abstraction yet; this change will primarily be direct class updates in `page.tsx` and `AIChatShell.tsx`.
- Because the shell is shared, rounded-corner changes applied in `AIChatShell.tsx` will also affect the anonymous chat on `login/page.tsx` and the simulation chat on `dashboard/page.tsx`.
- If homepage-only styling is desired later, the shell will need a mode-specific prop or wrapper class rather than a single global look.

## Acceptance Criteria

- No primary homepage surface or chat card has sharp square corners.
- The rounded system is visually consistent across the landing page and shared chat shell.
- Buttons, cards, and inputs still align cleanly after the radius update.
- The new look feels like a deliberate visual system rather than isolated one-off styling.

## Out of Scope

- No dashboard-wide restyling outside the shared chat shell.
- No color palette or typography overhaul.