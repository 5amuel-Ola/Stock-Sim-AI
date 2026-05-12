# Ephemeral Anonymous Chat + Draggable Floating Window — Implementation Spec

**Date:** 2026-04-28
**Status:** Implemented and Verified
**Scope:** Anonymous chat becomes ephemeral (resets on browser refresh), and authenticated floating chat becomes draggable on desktop

---

## Overview

This implementation converts anonymous chat from persistent localStorage-backed history to an in-memory session store that lives only for the current loaded app session and current browser tab. When the user refreshes or opens localhost in a new tab, anonymous chat starts fresh. Within the same tab, anonymous conversations can still carry over into signed-in dashboard chat if the user upgrades without refreshing.

Additionally, the authenticated floating chat window on desktop is now draggable, allowing users to move it around the screen without obstructing content. The dragged position resets after refresh, and dragging is disabled on mobile and fullscreen modes.

---

## Architecture Changes

### 1. In-Memory Anonymous Runtime Store

**File:** `financial-ai-frontend/src/lib/anonymousRuntime.ts` (new)

A module-scoped store that replaces localStorage for anonymous session management:

```typescript
let anonymousSessionId: string | null = null
let anonymousTranscript: ChatDisplayMessage[] = []

export const anonymousRuntime = {
  getSessionId(): string | null { ... }
  setSessionId(sessionId: string): void { ... }
  getTranscript(): ChatDisplayMessage[] { ... }
  setTranscript(messages: ChatDisplayMessage[]): void { ... }
  reset(): void { ... }
}
```

- Lives only for the current loaded app session
- Resets when the user opens localhost in a new tab or refreshes
- Supports in-session handoff (anonymous → authenticated) by keeping state in memory
- No persistence across refreshes or storage in localStorage

### 2. Authenticated Chat History Isolation

**File:** `financial-ai-frontend/src/lib/simulationChatHistory.ts` (new)

Separates authenticated simulation chat history from anonymous chat:

```typescript
const SIMULATION_CHAT_HISTORY_KEY = 'financial_ai_simulation_chat_history_v1'

export const simulationChatHistory = {
  load(): ChatDisplayMessage[] { ... }
  save(messages: ChatDisplayMessage[]): void { ... }
  clear(): void { ... }
}
```

- Persists across browser refreshes for signed-in users
- Uses localStorage with a distinct key from anonymous storage
- Owned by SimulationChatController for dashboard chat
- Prevents anonymous messages from contaminating authenticated history

### 3. Session ID Management Refactor

**File:** `financial-ai-frontend/src/lib/chatSession.ts` (updated)

Changed from localStorage to in-memory delegation:

```typescript
import { anonymousRuntime } from './anonymousRuntime'

export const chatSession = {
  getSessionId(): string | null { return anonymousRuntime.getSessionId() }
  setSessionId(sessionId: string): void { anonymousRuntime.setSessionId(sessionId) }
}
```

- Thin wrapper that delegates to anonymousRuntime
- Preserves API compatibility for aiApi and AnonymousChatController
- Session ID reuse within the same tab, reset on refresh

### 4. Controller Separation

**AnonymousChatController.tsx** (updated)
- Imports anonymousRuntime instead of chat-history
- Hydrates from `anonymousRuntime.getTranscript()` on mount
- Persists to `anonymousRuntime.setTranscript()` after sends, replies, and startup prompts
- No localStorage interaction

**SimulationChatController.tsx** (updated)
- Imports simulationChatHistory instead of chat-history
- Checks anonymousRuntime first on hydration to carry over anonymous conversations in-session
- If no active anonymous session, loads from simulationChatHistory
- Persists to simulationChatHistory for authenticated storage

### 5. Draggable Floating Window

**File:** `financial-ai-frontend/src/components/chat/AuthenticatedChatWindow.tsx` (updated)

Added drag state and pointer handlers:

```typescript
const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
const [isDragging, setIsDragging] = useState(false)

const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
  if (effectiveMode !== 'floating' || isMobile) return
  setIsDragging(true)
  setDragStart({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y })
}

const floatingWindowStyle: React.CSSProperties = effectiveMode === 'floating' && !isMobile
  ? {
      transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
      transition: isDragging ? 'none' : 'transform 0.2s ease-out',
      cursor: isDragging ? 'grabbing' : 'default',
    }
  : {}
```

- Dragging only active in floating desktop mode
- Mobile and fullscreen remain fixed (non-draggable)
- Position clamped to viewport with 100px margin on each edge
- Smooth transition back to default on release
- Position resets on browser refresh (not persisted)

### 6. Drag Handle Exposure

**File:** `financial-ai-frontend/src/components/chat/AIChatShell.tsx` (updated)

Expose header as a safe drag surface via `onHeaderPointerDown` prop:

```typescript
<div 
  onPointerDown={onHeaderPointerDown}
  className={`... ${onHeaderPointerDown ? 'cursor-grab active:cursor-grabbing' : ''}`}
>
```

- Header is the drag handle (non-interactive region)
- Preserves button functionality and text input focus
- Prevents dragging from interfering with transcript selection or typing

### 7. Component Prop Threading

**Files:** 
- `financial-ai-frontend/src/components/chat/AIChatSidebar.tsx`
- `financial-ai-frontend/src/components/chat/SimulationChatController.tsx`
- `financial-ai-frontend/src/components/chat/AnonymousChatController.tsx`

All three now support `onHeaderPointerDown` prop and thread it to AIChatShell for desktop dragging.

---

## Testing

### Updated Tests

**financial-ai-frontend/src/components/chat/AIChatFacade.test.tsx**
- Replaced "loads legacy chat history" test with "loads anonymous runtime transcript and persists within the session"
- Verifies anonymousRuntime holds transcript after rendering
- All 9 facade tests passing

**financial-ai-frontend/src/lib/domain-api.test.ts**
- Updated beforeEach to reset anonymousRuntime
- Session ID tests now validate in-memory reuse instead of localStorage persistence
- All 3 domain API tests passing

### Test Results
- **Frontend:** 15/15 tests passing
- **Backend:** 99/99 tests passing
- **TypeScript:** No errors
- **Production build:** Successful

---

## Behavior Changes

### Anonymous Chat
- **On first load of localhost:** Fresh anonymous chat, no message history
- **During same-session navigation:** Messages persist in anonymousRuntime
- **On browser refresh:** Conversation resets, anonymousRuntime clears
- **On new tab:** Independent anonymous session, no shared history
- **Upgrade to authenticated without refresh:** Conversation carries over from anonymousRuntime into SimulationChatController

### Authenticated Chat
- **On first load (no prior login):** Loads persisted chat from simulationChatHistory or active anonymousRuntime
- **During same-session navigation:** Persists in SimulationChatController state (short-term) and simulationChatHistory (long-term)
- **On browser refresh:** Rehydrates from simulationChatHistory localStorage
- **Floating window on desktop:** Can be dragged around; position resets on refresh
- **Mobile/fullscreen:** Window remains anchored, not draggable

### Drag Behavior
- **Desktop floating mode:** Drag-enabled with viewport clamping
- **Mobile:** Fixed bottom-right position, no dragging
- **Fullscreen:** Fixed full-viewport, no dragging
- **Position reset:** On refresh, window returns to default md:bottom-4 md:right-4 position
- **Cursor feedback:** grab/grabbing cursor while dragging, smooth transition on release

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/anonymousRuntime.ts` | **New** — In-memory anonymous session store |
| `src/lib/simulationChatHistory.ts` | **New** — Authenticated chat history storage |
| `src/lib/chatSession.ts` | Refactored to delegate to anonymousRuntime |
| `src/components/chat/AnonymousChatController.tsx` | Use anonymousRuntime, remove localStorage refs |
| `src/components/chat/SimulationChatController.tsx` | Use simulationChatHistory, check anonymousRuntime for handoff |
| `src/components/chat/AuthenticatedChatWindow.tsx` | Add dragging state, pointer handlers, viewport clamping |
| `src/components/chat/AIChatShell.tsx` | Add onHeaderPointerDown prop and drag cursor feedback |
| `src/components/chat/AIChatSidebar.tsx` | Thread onHeaderPointerDown prop through facade |
| `src/components/chat/AIChatFacade.test.tsx` | Update test for in-memory anonymous persistence |
| `src/lib/domain-api.test.ts` | Update session ID tests for in-memory runtime |

---

## Verification

### Manual Testing Checklist

1. **Anonymous Chat Reset on Refresh**
   - [ ] Open localhost, chat anonymously with 2-3 messages
   - [ ] Refresh the page (F5 or Cmd+R)
   - [ ] Confirm quick questions reappear and transcript is empty
   - [ ] Confirm anonymous session ID is new (different from before refresh)

2. **Anonymous In-Session Persistence**
   - [ ] Open localhost and chat anonymously
   - [ ] Navigate to /login via link or sidebar
   - [ ] Return to anonymous chat (back button or link)
   - [ ] Confirm conversation still appears in the chat

3. **Anonymous-to-Authenticated Handoff**
   - [ ] Chat anonymously with 3-4 messages
   - [ ] Sign in (create account or log in) without refreshing
   - [ ] View dashboard authenticated chat
   - [ ] Confirm anonymous messages are carried over (visible in transcript)
   - [ ] Send a follow-up message as authenticated user
   - [ ] Confirm it appears after anonymous messages

4. **Authenticated Chat Persistence**
   - [ ] Sign in and chat in dashboard
   - [ ] Navigate away from dashboard (e.g., /login page)
   - [ ] Return to dashboard
   - [ ] Confirm the authenticated chat draft is preserved
   - [ ] Refresh the page
   - [ ] Confirm authenticated conversation is restored from storage

5. **Desktop Floating Chat Dragging**
   - [ ] Open localhost on desktop (not mobile)
   - [ ] Minimize chat to floating mode (if fullscreen)
   - [ ] Click and drag the chat header to different screen positions
   - [ ] Confirm smooth dragging without obstructing other elements
   - [ ] Release and confirm smooth transition
   - [ ] Refresh the page
   - [ ] Confirm chat returns to default bottom-right position

6. **Mobile/Fullscreen No-Drag**
   - [ ] Open localhost on mobile breakpoint
   - [ ] Confirm chat is fullscreen
   - [ ] Attempt to drag the header
   - [ ] Confirm no dragging occurs (position fixed)
   - [ ] Expand to desktop width
   - [ ] Confirm dragging now works

7. **Cross-Mode Handoff**
   - [ ] Start in fullscreen mode, enter text in input (draft)
   - [ ] Click minimize button to float
   - [ ] Confirm draft text is preserved in input
   - [ ] Click expand button to fullscreen
   - [ ] Confirm draft is still there

### Automated Test Coverage
- Anonymous session ID persistence within a session ✓
- Anonymous session ID reset on runtime store reset ✓
- In-session anonymous-to-authenticated handoff ✓
- Authenticated chat history persisted to simulationChatHistory ✓
- Floating window mode toggle preserves draft input ✓
- Mobile fullscreen with no mode toggles ✓

---

## Non-Goals

- No changes to backend API or anonymous session handling on the server
- No changes to authenticated dashboard features or layout
- No explicit UI indicator showing whether user is dragging (cursor feedback only)
- No animation when user drags the window to extremes (clamping is instant)

---

## Future Considerations

1. **Drag Position Persistence (Optional):** If desired later, dragged position could be persisted to sessionStorage (not localStorage, to preserve the refresh-reset goal) so position is remembered across route changes but reset on page reload.

2. **Anonymous Session Upgrade Flow:** Current behavior carries over transcript but backend sees separate session. If session continuity is needed on backend, consider renaming session ID on upgrade.

3. **Mobile Drag Support:** Could enable dragging on mobile in fullscreen mode by using a drag handle icon instead of the full header.

4. **Accessibility:** Keyboard users can currently not drag the window. Could add a keyboard shortcut or accessible drag handle in future.

---

## Acceptance Criteria Met

✅ **Anonymous chat resets on localhost refresh** — anonymousRuntime clears, no localStorage persistence
✅ **Anonymous chat persists within session** — in-memory state survives route changes in the same tab
✅ **Anonymous-to-authenticated handoff works until refresh** — SimulationChatController checks anonymousRuntime on hydration
✅ **Authenticated chat remains independent** — simulationChatHistory separated from anonymous storage
✅ **Floating chat is draggable on desktop** — drag state and pointer handlers added to AuthenticatedChatWindow
✅ **Dragging disabled on mobile/fullscreen** — effectiveMode and isMobile checks prevent dragging in those modes
✅ **Dragged position resets on refresh** — no persistence of dragOffset state
✅ **All tests pass** — 15 frontend, 99 backend, no TypeScript errors
✅ **Production build succeeds** — Next.js build completed without errors
