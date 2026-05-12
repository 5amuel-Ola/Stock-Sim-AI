// financial-ai-backend/src/test/setup.ts
import { vi, beforeEach } from 'vitest'

vi.mock('../lib/config', () => ({
  config: {
    DATABASE_URL: 'postgresql://test',
    JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long!!',
    GOOGLE_GEMINI_API_KEY: 'test-google-gemini-key',
    OPENAI_API_KEY: 'test-openai-key',
    PORT: '3001',
    NODE_ENV: 'test' as const,
  },
}))

vi.mock('../lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    simulationAccount: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    position: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    order: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    security: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    anonymousUsage: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})
