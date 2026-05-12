import crypto from 'crypto'
import {
  prismaAnonymousUsageRepository,
  type AnonymousUsageRepository,
} from './anonymous-usage.repository'

export const ANONYMOUS_MESSAGE_LIMIT = 7

export function createAnonymousUsageService(repository: AnonymousUsageRepository) {
  return {
    async consumeAnonymousMessage(sessionId: string): Promise<{
      allowed: boolean
      messageCount: number
      remaining: number
    }> {
      const usage = await repository.incrementMessageCount(sessionId)
      const allowed = usage.messageCount <= ANONYMOUS_MESSAGE_LIMIT

      return {
        allowed,
        messageCount: usage.messageCount,
        remaining: Math.max(ANONYMOUS_MESSAGE_LIMIT - usage.messageCount, 0),
      }
    },

    async resetAnonymousUsageForTests(): Promise<void> {
      await repository.clearAll()
    },
  }
}

const anonymousUsageService = createAnonymousUsageService(prismaAnonymousUsageRepository)

export const consumeAnonymousMessage = anonymousUsageService.consumeAnonymousMessage

export function getOrCreateSessionId(sessionId?: string): string {
  const normalized = sessionId?.trim()
  if (normalized) return normalized
  return crypto.randomUUID()
}

export async function resetAnonymousUsageForTests(): Promise<void> {
  await anonymousUsageService.resetAnonymousUsageForTests()
}
