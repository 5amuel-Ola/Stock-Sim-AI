import type { Request } from 'express'
import { ANONYMOUS_MESSAGE_LIMIT, consumeAnonymousMessage, getOrCreateSessionId } from './anonymous-usage.service'

export interface ChatAccessResult {
  isAnonymous: boolean
  sessionId?: string
  messageCount?: number
  remainingMessages?: number
  allowed: boolean
}

export const chatAccessService = {
  async evaluate(req: Request): Promise<ChatAccessResult> {
    if (req.user?.userId) {
      return {
        isAnonymous: false,
        allowed: true,
      }
    }

    const sessionId = getOrCreateSessionId(req.header('x-session-id') ?? undefined)
    const usage = await consumeAnonymousMessage(sessionId)

    return {
      isAnonymous: true,
      sessionId,
      messageCount: usage.messageCount,
      remainingMessages: usage.remaining,
      allowed: usage.allowed,
    }
  },

  buildLimitPayload(access: ChatAccessResult) {
    return {
      error: 'Anonymous chat limit reached. Sign up to continue.',
      code: 'UPGRADE_REQUIRED',
      isAnonymous: true,
      sessionId: access.sessionId,
      messageCount: access.messageCount,
      remainingMessages: access.remainingMessages,
      limit: ANONYMOUS_MESSAGE_LIMIT,
    }
  },
}
