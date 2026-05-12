import { chatSession } from './chatSession'
import { ApiError } from './httpClient'
import { requestWithOptionalAuth } from './apiTransport'
import type { InvestmentSuggestions, RiskAnalysis, TrendAnalysis } from './types'

export const aiApi = {
  getRiskAnalysis() {
    return requestWithOptionalAuth<RiskAnalysis>('/ai/risk-analysis')
  },

  getTrendAnalysis() {
    return requestWithOptionalAuth<TrendAnalysis>('/ai/trends')
  },

  getInvestmentSuggestions() {
    return requestWithOptionalAuth<InvestmentSuggestions>('/ai/suggestions')
  },

  getAISummary() {
    return requestWithOptionalAuth<{ summary: string }>('/ai/summary')
  },

  async aiChat(
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[] = []
  ) {
    const sessionId = chatSession.getSessionId()

    try {
      const result = await requestWithOptionalAuth<{
        reply: string
        sessionId?: string
        isAnonymous?: boolean
        messageCount?: number
        remainingMessages?: number
      }>('/ai/chat', {
        method: 'POST',
        headers: sessionId ? { 'x-session-id': sessionId } : undefined,
        body: JSON.stringify({ message, history }),
      })

      if (result.sessionId) chatSession.setSessionId(result.sessionId)
      return result
    } catch (error) {
      if (error instanceof ApiError) {
        const nextSessionId = typeof error.details?.sessionId === 'string' ? error.details.sessionId : null
        if (nextSessionId) chatSession.setSessionId(nextSessionId)
      }
      throw error
    }
  },
}