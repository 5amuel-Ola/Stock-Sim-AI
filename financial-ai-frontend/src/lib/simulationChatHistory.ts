/**
 * Authenticated simulation chat history storage.
 * Persists across route changes and browser refreshes using localStorage.
 * Owned by SimulationChatController for signed-in dashboard chat.
 */

import type { ChatDisplayMessage } from '../components/chat/chat.types'

const SIMULATION_CHAT_HISTORY_KEY = 'financial_ai_simulation_chat_history_v1'

function isChatMessage(value: unknown): value is Partial<ChatDisplayMessage> {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as { role?: unknown; text?: unknown }
  return (candidate.role === 'user' || candidate.role === 'ai') && typeof candidate.text === 'string'
}

function normalizeChatMessage(value: Partial<ChatDisplayMessage>, index: number): ChatDisplayMessage {
  // Generate a stable id if missing (for legacy messages)
  // Use index-based id since legacy messages don't have an id field
  const id = (value as any).id || `legacy-${Date.now()}-${index}`
  return {
    id,
    role: value.role as 'user' | 'ai',
    text: value.text || '',
  }
}

export const simulationChatHistory = {
  load(): ChatDisplayMessage[] {
    if (typeof window === 'undefined') {
      return []
    }

    try {
      const raw = localStorage.getItem(SIMULATION_CHAT_HISTORY_KEY)
      if (!raw) {
        return []
      }

      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        return []
      }

      // Filter for valid messages and normalize with ids
      return parsed
        .filter(isChatMessage)
        .map(normalizeChatMessage)
    } catch {
      return []
    }
  },

  save(messages: ChatDisplayMessage[]): void {
    if (typeof window === 'undefined') {
      return
    }

    localStorage.setItem(SIMULATION_CHAT_HISTORY_KEY, JSON.stringify(messages.slice(-40)))
  },

  clear(): void {
    if (typeof window === 'undefined') {
      return
    }

    localStorage.removeItem(SIMULATION_CHAT_HISTORY_KEY)
  },
}
