# See Features Reveal — Design Spec

**Date:** 2026-04-27
**Status:** Draft

---

## Goal

Make the `See Features` action visibly reveal the website's capabilities instead of feeling like a broken or redundant scroll button.

## Problem Statement

The current feature section is already rendered on initial load, so clicking `See Features` only scrolls. Because nothing new appears, the action does not read as a meaningful feature reveal.

## Scope

This change applies to the homepage landing experience only.

## Primary File

- `financial-ai-frontend/src/app/page.tsx`

## Current Implementation Snapshot

- The homepage defines a local `FEATURE_CARDS` constant in `page.tsx` with three cards: `AI Guidance`, `Trading Simulator`, and `Portfolio Insight`.
- `scrollToFeatures()` currently calls `featuresRef.current?.scrollIntoView(...)`.
- The feature section is always rendered below the main hero/chat grid, so the current button only scrolls.
- All current feature cards route to the same target, `/dashboard`.
- `handleFeatureSelect()` already gates anonymous users through `/login?mode=register&next=/dashboard`, and `login/page.tsx` already honors a safe `next` path after authentication.

## Required Behavior

- The homepage initially loads in a compact chat-first state.
- The feature section starts hidden or collapsed.
- Clicking `See Features` expands the feature section and scrolls it into view.
- When expanded, the button label changes to `Hide Features`.
- Clicking the button again collapses the feature section.

## Implementation Notes

- This is a pure frontend state change in `page.tsx`; no backend dependency or new route is required.
- A local `showFeatures` boolean plus conditional render or animated collapse is sufficient.
- Because all cards currently target `/dashboard`, this reveal is informational rather than a deep-link map of distinct routes.
- If separate feature destinations are introduced later, update the `FEATURE_CARDS` targets rather than the reveal behavior itself.

## Feature Content

The revealed section continues to present the authenticated product surfaces:
- AI Guidance
- Trading Simulator
- Portfolio Insight

Each feature card must remain gated by authentication.

## Authentication Rule

- Logged-in users are routed directly to the selected feature target.
- Logged-out users are routed to login/register with the intended destination preserved.

## Acceptance Criteria

- On initial load, the homepage emphasizes the hero and chat instead of a full feature grid.
- Clicking `See Features` visibly changes the page state, not just the scroll position.
- Expanded and collapsed states are clearly distinguishable.
- Feature cards remain accessible and clickable after reveal.
- Auth redirect behavior continues to preserve `/dashboard` as the post-login destination.

## Out of Scope

- No separate marketing page.
- No modal-only feature browser.