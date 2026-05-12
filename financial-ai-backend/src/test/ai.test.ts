// financial-ai-backend/src/test/ai.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app'
import jwt from 'jsonwebtoken'
import { config } from '../lib/config'
import type {
  RiskAnalysisResponse,
  TrendAnalysisResponse,
  SuggestionsResponse,
} from '../ai/ai.types'
import { AppError } from '../lib/errors'
import { resetAnonymousUsageForTests } from '../ai/anonymous-usage.service'
import { prisma } from '../lib/prisma'

// Mock the entire ai.service so OpenAI/Gemini SDKs are never initialised
vi.mock('../ai/ai.service', () => ({
  aiService: {
    chat: vi.fn(),
    summary: vi.fn(),
    riskAnalysis: vi.fn(),
    trendAnalysis: vi.fn(),
    investmentSuggestions: vi.fn(),
  },
}))

vi.mock('../simulation/simulation.service', () => ({
  simulationService: {
    getAllPositionsForAIContext: vi.fn(),
  },
}))

vi.mock('../market/market.service', () => ({
  marketService: {
    getStockPrice: vi.fn(),
    getCryptoPrice: vi.fn(),
  },
}))

import { aiService } from '../ai/ai.service'
import { marketService } from '../market/market.service'
import { simulationService } from '../simulation/simulation.service'

const app = buildApp()

function makeToken(userId: string) {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: '15m' })
}

beforeEach(async () => {
  await resetAnonymousUsageForTests()
  let messageCounts = new Map<string, number>()
  vi.mocked((prisma as any).anonymousUsage.deleteMany).mockImplementation(async () => {
    messageCounts = new Map<string, number>()
    return { count: 0 }
  })
  vi.mocked((prisma as any).anonymousUsage.upsert).mockImplementation(async ({ where, create, update }: any) => {
    const sessionId = where.sessionId as string
    const current = messageCounts.get(sessionId) ?? 0
    const nextCount = current === 0 ? create.messageCount : current + update.messageCount.increment
    messageCounts.set(sessionId, nextCount)
    return {
      id: `anon-${sessionId}`,
      sessionId,
      messageCount: nextCount,
      lastMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  })
  vi.mocked(simulationService.getAllPositionsForAIContext).mockResolvedValue({
    assets: [
      { symbol: 'AAPL', type: 'STOCK',  quantity: 10,  currentPrice: 175.5  },
      { symbol: 'BTC',  type: 'CRYPTO', quantity: 0.5, currentPrice: 45000  },
    ],
  })
  vi.mocked(marketService.getStockPrice).mockResolvedValue({
    symbol: 'AAPL',
    price: 190.25,
    previousClose: 188.1,
    changePercent: 1.14,
    type: 'STOCK',
    timestamp: '2026-04-22T23:00:00.000Z',
  })
  vi.mocked(marketService.getCryptoPrice).mockResolvedValue({
    symbol: 'BTC',
    price: 68000,
    previousClose: 67100,
    changePercent: 1.34,
    type: 'CRYPTO',
    timestamp: '2026-04-22T23:00:00.000Z',
  })
})

describe('POST /api/v1/ai/chat', () => {
  it('allows authenticated chat with account context', async () => {
    vi.mocked(aiService.chat).mockResolvedValue({ reply: 'Hello investor.' })
    const history = [{ role: 'assistant', content: 'Previous context' }]

    const res = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${makeToken('user-1')}`)
      .send({ message: 'What should I buy?', history })

    expect(res.status).toBe(200)
    expect(res.body.reply).toBe('Hello investor.')
    expect(res.body.isAnonymous).toBe(false)
    expect(res.body.sessionId).toBeUndefined()
    expect(simulationService.getAllPositionsForAIContext).toHaveBeenCalledWith('user-1')
    expect(aiService.chat).toHaveBeenCalledWith('What should I buy?', expect.any(Object), history)
  })

  it('ignores x-session-id when the request is authenticated', async () => {
    vi.mocked(aiService.chat).mockResolvedValue({ reply: 'Hello investor.' })

    const res = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${makeToken('user-1')}`)
      .set('x-session-id', 'should-not-apply')
      .send({ message: 'What should I buy?' })

    expect(res.status).toBe(200)
    expect(res.body.isAnonymous).toBe(false)
    expect(res.body.sessionId).toBeUndefined()
  })

  it('allows anonymous chat for up to 7 messages per session id', async () => {
    vi.mocked(aiService.chat).mockResolvedValue({ reply: 'Anon reply.' })

    for (let i = 0; i < 7; i += 1) {
      const res = await request(app)
        .post('/api/v1/ai/chat')
        .set('x-session-id', 'anon-abc')
        .send({ message: `message-${i}` })

      expect(res.status).toBe(200)
      expect(res.body.reply).toBe('Anon reply.')
      expect(res.body.isAnonymous).toBe(true)
      expect(res.body.sessionId).toBe('anon-abc')
      expect(res.body.messageCount).toBe(i + 1)
      expect(res.body.remainingMessages).toBe(6 - i)
    }

    expect(simulationService.getAllPositionsForAIContext).not.toHaveBeenCalled()
  })

  it('enriches anonymous chat with live market snapshots for mentioned symbols', async () => {
    vi.mocked(aiService.chat).mockResolvedValue({ reply: 'AAPL is trading near $190.' })

    const res = await request(app)
      .post('/api/v1/ai/chat')
      .set('x-session-id', 'anon-market')
      .send({ message: 'How much is AAPL worth right now?' })

    expect(res.status).toBe(200)
    expect(marketService.getStockPrice).toHaveBeenCalledWith('AAPL')
    expect(aiService.chat).toHaveBeenCalledWith(
      'How much is AAPL worth right now?',
      expect.objectContaining({
        assets: expect.arrayContaining([
          expect.objectContaining({
            symbol: 'AAPL',
            quantity: 'market snapshot',
            currentPrice: 190.25,
            previousClose: 188.1,
            changePercent: 1.14,
          }),
        ]),
      }),
      [],
    )
  })

  it('creates a stable sessionId in the anonymous response contract when none is provided', async () => {
    vi.mocked(aiService.chat).mockResolvedValue({ reply: 'Anon reply.' })

    const res = await request(app)
      .post('/api/v1/ai/chat')
      .send({ message: 'hello' })

    expect(res.status).toBe(200)
    expect(res.body.isAnonymous).toBe(true)
    expect(typeof res.body.sessionId).toBe('string')
    expect(res.body.sessionId.length).toBeGreaterThan(10)
    expect(res.body.messageCount).toBe(1)
  })

  it('blocks anonymous chat at the 8th message with UPGRADE_REQUIRED', async () => {
    vi.mocked(aiService.chat).mockResolvedValue({ reply: 'Anon reply.' })

    for (let i = 0; i < 7; i += 1) {
      await request(app)
        .post('/api/v1/ai/chat')
        .set('x-session-id', 'anon-limit')
        .send({ message: `message-${i}` })
    }

    const blocked = await request(app)
      .post('/api/v1/ai/chat')
      .set('x-session-id', 'anon-limit')
      .send({ message: 'message-8' })

    expect(blocked.status).toBe(403)
    expect(blocked.body.code).toBe('UPGRADE_REQUIRED')
    expect(blocked.body.isAnonymous).toBe(true)
    expect(blocked.body.sessionId).toBe('anon-limit')
    expect(blocked.body.messageCount).toBe(8)
    expect(blocked.body.remainingMessages).toBe(0)
    expect(blocked.body.limit).toBe(7)
  })

  it('rejects malformed authorization headers on optional-auth chat route', async () => {
    const res = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', 'Token nope')
      .send({ message: 'hello' })

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('UNAUTHORIZED')
  })
})

describe('GET /api/v1/ai/risk-analysis', () => {
  it('returns structured risk analysis JSON', async () => {
    const mockResponse: RiskAnalysisResponse = {
      riskLevel: 'medium',
      diversificationScore: 6,
      concentrationWarnings: ['BTC represents ~72% of portfolio value'],
      sectorExposure: { Technology: 30, Crypto: 70 },
      totalPortfolioValue: 23505,
      recommendation: 'Reduce crypto concentration to below 50%.',
    }
    vi.mocked(aiService.riskAnalysis).mockResolvedValue(mockResponse)

    const res = await request(app)
      .get('/api/v1/ai/risk-analysis')
      .set('Authorization', `Bearer ${makeToken('user-1')}`)

    expect(res.status).toBe(200)
    expect(res.body.riskLevel).toBe('medium')
    expect(res.body.diversificationScore).toBe(6)
    expect(Array.isArray(res.body.concentrationWarnings)).toBe(true)
    expect(typeof res.body.sectorExposure).toBe('object')
    expect(typeof res.body.totalPortfolioValue).toBe('number')
    expect(typeof res.body.recommendation).toBe('string')
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/ai/risk-analysis')
    expect(res.status).toBe(401)
  })

  it('returns 502 when agent fails', async () => {
    vi.mocked(aiService.riskAnalysis).mockRejectedValue(
      new AppError('AI agent unavailable', 502, 'AI_ERROR')
    )

    const res = await request(app)
      .get('/api/v1/ai/risk-analysis')
      .set('Authorization', `Bearer ${makeToken('user-1')}`)

    expect(res.status).toBe(502)
  })
})

describe('GET /api/v1/ai/trends', () => {
  it('returns structured trend analysis JSON', async () => {
    const mockResponse: TrendAnalysisResponse = {
      overallSentiment: 'bullish',
      assetTrends: [
        { symbol: 'AAPL', trend: 'bullish', reasoning: 'Strong earnings growth.' },
        { symbol: 'BTC', trend: 'neutral', reasoning: 'Consolidating after recent rally.' },
      ],
      topInsights: [
        'Tech sector outperforming S&P 500',
        'Crypto regulatory clarity improving',
        'Fed rate expectations stabilizing',
        'Consumer spending remains resilient',
        'Institutional BTC adoption continues',
      ],
      marketOutlook: 'Mixed signals with overall positive bias.',
    }
    vi.mocked(aiService.trendAnalysis).mockResolvedValue(mockResponse)

    const res = await request(app)
      .get('/api/v1/ai/trends')
      .set('Authorization', `Bearer ${makeToken('user-1')}`)

    expect(res.status).toBe(200)
    expect(['bullish', 'bearish', 'neutral']).toContain(res.body.overallSentiment)
    expect(Array.isArray(res.body.assetTrends)).toBe(true)
    expect(res.body.assetTrends).toHaveLength(2)
    expect(res.body.assetTrends[0]).toMatchObject({ symbol: 'AAPL', trend: 'bullish' })
    expect(Array.isArray(res.body.topInsights)).toBe(true)
    expect(typeof res.body.marketOutlook).toBe('string')
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/ai/trends')
    expect(res.status).toBe(401)
  })

  it('returns 502 when agent fails', async () => {
    vi.mocked(aiService.trendAnalysis).mockRejectedValue(
      new AppError('AI agent unavailable', 502, 'AI_ERROR')
    )

    const res = await request(app)
      .get('/api/v1/ai/trends')
      .set('Authorization', `Bearer ${makeToken('user-1')}`)

    expect(res.status).toBe(502)
  })
})

describe('GET /api/v1/ai/suggestions', () => {
  it('returns structured investment suggestions JSON', async () => {
    const mockResponse: SuggestionsResponse = {
      suggestions: [
        { action: 'sell', symbol: 'BTC', reasoning: 'Overweight at 72% of portfolio.', priority: 'high' },
        { action: 'buy', symbol: 'AAPL', reasoning: 'Underweight relative to goals.', priority: 'medium' },
        { action: 'hold', symbol: 'BTC', reasoning: 'Keep a core position.', priority: 'low' },
      ],
      summary: 'Reduce BTC concentration and rebalance into equities.',
    }
    vi.mocked(aiService.investmentSuggestions).mockResolvedValue(mockResponse)

    const res = await request(app)
      .get('/api/v1/ai/suggestions')
      .set('Authorization', `Bearer ${makeToken('user-1')}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.suggestions)).toBe(true)
    expect(res.body.suggestions).toHaveLength(3)
    const first = res.body.suggestions[0]
    expect(['buy', 'sell', 'hold', 'rebalance']).toContain(first.action)
    expect(typeof first.symbol).toBe('string')
    expect(typeof first.reasoning).toBe('string')
    expect(['high', 'medium', 'low']).toContain(first.priority)
    expect(typeof res.body.summary).toBe('string')
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/ai/suggestions')
    expect(res.status).toBe(401)
  })

  it('returns 502 when agent fails', async () => {
    vi.mocked(aiService.investmentSuggestions).mockRejectedValue(
      new AppError('AI agent unavailable', 502, 'AI_ERROR')
    )

    const res = await request(app)
      .get('/api/v1/ai/suggestions')
      .set('Authorization', `Bearer ${makeToken('user-1')}`)

    expect(res.status).toBe(502)
  })
})

describe('GET /api/v1/ai/summary', () => {
  it('still works after adding OpenAI agents', async () => {
    vi.mocked(aiService.summary).mockResolvedValue({ summary: 'Portfolio consists of AAPL and BTC.' })

    const res = await request(app)
      .get('/api/v1/ai/summary')
      .set('Authorization', `Bearer ${makeToken('user-1')}`)

    expect(res.status).toBe(200)
    expect(typeof res.body.summary).toBe('string')
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/ai/summary')
    expect(res.status).toBe(401)
  })

  it('returns 502 when AI is unavailable', async () => {
    vi.mocked(aiService.summary).mockRejectedValue(
      new AppError('AI service unavailable', 502, 'AI_ERROR')
    )

    const res = await request(app)
      .get('/api/v1/ai/summary')
      .set('Authorization', `Bearer ${makeToken('user-1')}`)

    expect(res.status).toBe(502)
  })
})
