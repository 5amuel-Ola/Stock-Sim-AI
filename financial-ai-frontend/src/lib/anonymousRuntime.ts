/**
 * In-memory anonymous runtime store.
 * Lives only for the current loaded app session and current tab lifecycle.
 * Does NOT persist across refreshes or localStorage.
 * Supports anonymous chat handoff into authenticated chat within the same session.
 */

import type { ChatDisplayMessage } from '../components/chat/chat.types'

let anonymousSessionId: string | null = null
let anonymousTranscript: ChatDisplayMessage[] = []

export const anonymousRuntime = {
  /**
   * Get the current anonymous session ID for this loaded app session.
   * Returns null if no anonymous session has been started.
   */
  getSessionId(): string | null {
    return anonymousSessionId
  },

  /**
   * Set or update the anonymous session ID for this loaded app session.
   * This ID is used to correlate requests with the backend.
   */
  setSessionId(sessionId: string): void {
    anonymousSessionId = sessionId
  },

  /**
   * Get the current anonymous transcript for this loaded app session.
   * Returns an empty array if no anonymous session exists.
   */
  getTranscript(): ChatDisplayMessage[] {
    return [...anonymousTranscript]
  },

  /**
   * Set the anonymous transcript for this loaded app session.
   * Used after receiving a response from the backend or when carrying over into authenticated chat.
   */
  setTranscript(messages: ChatDisplayMessage[]): void {
    anonymousTranscript = messages
  },

  /**
   * Replace the entire anonymous session (both transcript and session ID).
   * Used to reset on logout or abandon anonymous state.
   */
  reset(): void {
    anonymousSessionId = null
    anonymousTranscript = []
  },
}
