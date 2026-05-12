import { prisma } from '../lib/prisma'

export interface AnonymousUsageRecord {
  sessionId: string
  messageCount: number
}

export interface AnonymousUsageRepository {
  incrementMessageCount(sessionId: string): Promise<AnonymousUsageRecord>
  clearAll(): Promise<void>
}

export const prismaAnonymousUsageRepository: AnonymousUsageRepository = {
  async incrementMessageCount(sessionId: string): Promise<AnonymousUsageRecord> {
    const usage = await prisma.anonymousUsage.upsert({
      where: { sessionId },
      update: {
        messageCount: { increment: 1 },
        lastMessageAt: new Date(),
      },
      create: {
        sessionId,
        messageCount: 1,
        lastMessageAt: new Date(),
      },
    })

    return {
      sessionId: usage.sessionId,
      messageCount: usage.messageCount,
    }
  },

  async clearAll(): Promise<void> {
    await prisma.anonymousUsage.deleteMany()
  },
}