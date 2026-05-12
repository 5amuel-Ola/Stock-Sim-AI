/**
 * Thin wrapper for anonymous chat session ID management.
 * Delegates to the in-memory anonymous runtime store so the session ID
 * lives only for the current loaded app session and resets on refresh.
 * This preserves session reuse within a tab but ensures no persistence across refreshes.
 */

import { anonymousRuntime } from './anonymousRuntime'

export const chatSession = {
  getSessionId(): string | null {
    if (typeof window === 'undefined') return null
    return anonymousRuntime.getSessionId()
  },

  setSessionId(sessionId: string): void {
    if (typeof window === 'undefined') return
    anonymousRuntime.setSessionId(sessionId)
  },
}
