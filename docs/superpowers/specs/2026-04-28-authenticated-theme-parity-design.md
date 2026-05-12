# Authenticated Theme Parity — Design Spec

**Date:** 2026-04-28
**Status:** Approved
**Scope:** Align authenticated `financial-ai-frontend` surfaces with the existing public visual language

---

## Overview

Bring the authenticated experience into visual parity with the existing public homepage and login flow.

The current public pages use:
1. A warm cream gradient page background
2. Rounded, softly shadowed surfaces
3. Serif-forward headline styling
4. Higher use of translucent white panels and softened borders

The authenticated dashboard previously used a flatter black-and-white system with harder edges. This change updates the authenticated layout, dashboard header, dashboard cards, and authenticated chat window so the transition from public to authenticated pages feels like one product.

No business logic changes are included in this spec.

---

## Approach

**Option B — Keep the existing authenticated structure, replace the presentation layer.**

- Preserve the authenticated routing structure and dashboard composition
- Keep existing feature modules, charts, modals, and AI behavior intact
- Shift the authenticated shell to the same gradient + rounded-card language already used by the public pages
- Update shared utility classes where safe so downstream authenticated components inherit the new look automatically

---

## Section 1: Authenticated Shell

### Dashboard layout background

The authenticated layout uses the same warm radial/linear gradient family as the public homepage.

Behavior:

- Full authenticated viewport renders on the cream gradient backdrop
- Content is constrained to the same max-width shell used on the public landing experience
- Existing persistent authenticated chat mount remains unchanged in ownership and behavior

### Header styling

The authenticated dashboard header becomes a rounded translucent surface rather than a flat white bar.

Changes:

- Add rounded corners
- Use translucent white background with backdrop blur
- Add the same eyebrow label treatment used on public pages
- Promote a softer serif headline rather than the previous utilitarian title row

---

## Section 2: Dashboard Surface Styling

### Summary cards and content cards

Authenticated cards adopt the same surface treatment as the public cards:

- rounded corners
- softened border opacity
- translucent white or warm off-white background
- larger soft shadow

This applies to:

- summary stat tiles
- empty states
- portfolio sections
- charts and insight cards through shared `swiss-card` utilities

### Shared component utilities

Update the existing `swiss-*` utility classes rather than restyling each leaf component independently.

Affected utilities:

- `swiss-card`
- `swiss-card-compact`
- `swiss-btn`
- `swiss-btn-primary`
- `swiss-btn-sm`
- `swiss-input`
- `swiss-badge`

This keeps the authenticated surface consistent without changing component responsibilities.

---

## Section 3: Authenticated Chat Window Styling

The authenticated floating/fullscreen chat window keeps its existing behavior but inherits the public visual language.

Changes:

- floating window uses rounded card chrome with the same soft shadow family as public chat panels
- fullscreen mode renders over the same cream gradient background instead of a plain white overlay
- chat shell surfaces use translucent white backgrounds and softer quick-action chrome

No chat logic, persistence, or mode-switch behavior changes are part of this spec.

---

## Files Changed

| File | Change |
|------|--------|
| `financial-ai-frontend/src/app/dashboard/layout.tsx` | Apply public-style shell background and width constraint |
| `financial-ai-frontend/src/app/dashboard/page.tsx` | Update authenticated header and summary-card presentation |
| `financial-ai-frontend/src/app/login/page.tsx` | Bring login surface into the same page-shell language |
| `financial-ai-frontend/src/components/chat/AuthenticatedChatWindow.tsx` | Restyle authenticated floating/fullscreen window chrome |
| `financial-ai-frontend/src/components/chat/AIChatShell.tsx` | Update chat panel surface styling |
| `financial-ai-frontend/src/app/globals.css` | Refresh shared `swiss-*` utility classes |

---

## Non-Goals

- No dashboard information architecture changes
- No chat feature behavior changes
- No backend or API changes
- No route or auth-flow changes

---

## Testing

- Run frontend test suite to confirm no component regressions
- Run `tsc --noEmit`
- Run production build to verify authenticated pages still compile under Next.js app routing
- Perform visual smoke checks on homepage, login, dashboard, and authenticated floating chat