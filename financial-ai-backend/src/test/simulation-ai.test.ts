// financial-ai-backend/src/test/simulation-ai.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import 'express-async-errors'
import jwt from 'jsonwebtoken'
import { simulationRouter } from '../simulation/simulation.router'
import { errorHandler } from '../middleware/error.middleware'
import { authenticate } from '../middleware/auth.middleware'
import { AppError } from '../lib/errors'
import type { SimulationAccountContext, TradeCoachResponse, RiskManagerResponse, StrategyGeneratorResponse } from '../ai/ai.types'

const app = express()
app.use(express.json())
app.use('/api/v1/simulation', authenticate, simulationRouter)
app.use(errorHandler)

const JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!'
const token = (userId = 'user-1') => jwt.sign({ userId }, JWT_SECRET)

vi.mock('../simulation/simulation.service', () => ({
  simulationService: {
    createAccount: vi.fn(),
    getAccounts: vi.fn(),
    getAccount: vi.fn(),
    deleteAccount: vi.fn(),
    confirmChatTrade: vi.fn(),
    executeTrade: vi.fn(),
    getOrders: vi.fn(),
    getAccountForAIContext: vi.fn(),
    getAllPositionsForAIContext: vi.fn(),
  },
}))

vi.mock('../ai/ai.service', () => ({
  aiService: {
    simulationChat: vi.fn(),
    tradeCoach: vi.fn(),
    riskManager: vi.fn(),
    strategyGenerator: vi.fn(),
    chat: vi.fn(),
    summary: vi.fn(),
    riskAnalysis: vi.fn(),
    trendAnalysis: vi.fn(),
    investmentSuggestions: vi.fn(),
  },
}))

vi.mock('../market/market.service', () => ({
  marketService: { getPriceForAsset: vi.fn() },
}))

import { simulationService } from '../simulation/simulation.service'
import { aiService } from '../ai/ai.service'
import { marketService } from '../market/market.service'

const mockAccountContext: SimulationAccountContext = {
  name: 'Test Account',
  balance: 8200,
  positions: [
    { symbol: 'AAPL', type: 'STOCK', quantity: 10, avgCost: 180, currentPrice: 185, unrealizedPnL: 50 },
    { symbol: 'BTCUSD', type: 'CRYPTO', quantity: 0.5, avgCost: 60000, currentPrice: 65000, unrealizedPnL: 2500 },
  ],
  recentOrders: [
    { orderId: 'order-1', symbol: 'AAPL', side: 'BUY', quantity: 10, fillPrice: 180, totalValue: 1800, createdAt: new Date().toISOString() },
  ],
}

beforeEach(() => {
  vi.mocked(simulationService.getAccountForAIContext).mockResolvedValue(mockAccountContext)
})

describe('POST /api/v1/simulation/accounts/:id/ai/chat', () => {
  it('returns chat reply with account context', async () => {
    vi.mocked(aiService.simulationChat).mockResolvedValue({ kind: 'message', reply: 'Your AAPL position is up $50.' })

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: 'How is my AAPL doing?' })

    expect(res.status).toBe(200)
    expect(typeof res.body.reply).toBe('string')
    expect(res.body.reply).toContain('AAPL')
    expect(vi.mocked(simulationService.getAccountForAIContext)).toHaveBeenCalledWith('user-1', 'acct-1')
    expect(vi.mocked(aiService.simulationChat)).toHaveBeenCalledWith(
      'How is my AAPL doing?',
      mockAccountContext,
      []
    )
  })

  it('forwards provided conversation history unchanged to the AI service', async () => {
    const history = [
      { role: 'user' as const, content: 'How is AAPL doing?' },
      { role: 'assistant' as const, content: 'It is up today.' },
    ]
    vi.mocked(aiService.simulationChat).mockResolvedValue({ kind: 'message', reply: 'Given that context, hold for now.' })

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: 'Expand on that.', history })

    expect(res.status).toBe(200)
    expect(vi.mocked(aiService.simulationChat)).toHaveBeenCalledWith(
      'Expand on that.',
      mockAccountContext,
      history,
    )
  })

  it('returns 400 when history exceeds the maximum allowed turns', async () => {
    const history = Array.from({ length: 41 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message-${i}`,
    }))

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: 'Too much context?', history })

    expect(res.status).toBe(400)
    expect(vi.mocked(aiService.simulationChat)).not.toHaveBeenCalled()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .send({ message: 'Hello' })
    expect(res.status).toBe(401)
  })

  it('returns a trade proposal for buy me phrasing with the correct symbol', async () => {
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 270, type: 'STOCK', timestamp: new Date().toISOString(),
    })

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: 'Buy me 3 shares of AAPL' })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('trade_proposal')
    expect(res.body.proposal.symbol).toBe('AAPL')
    expect(res.body.proposal.quantity).toBe(3)
    expect(vi.mocked(aiService.simulationChat)).not.toHaveBeenCalled()
  })

  it('returns a trade proposal when the user names the company instead of the ticker', async () => {
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 270, type: 'STOCK', timestamp: new Date().toISOString(),
    })

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: 'Buy 3 shares of Apple' })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('trade_proposal')
    expect(res.body.proposal.symbol).toBe('AAPL')
    expect(res.body.proposal.quantity).toBe(3)
    expect(vi.mocked(marketService.getPriceForAsset)).toHaveBeenCalledWith('AAPL', 'STOCK')
    expect(vi.mocked(aiService.simulationChat)).not.toHaveBeenCalled()
  })

  it('returns a crypto trade proposal when the user names the coin instead of the ticker', async () => {
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'BTCUSD', price: 65000, type: 'CRYPTO', timestamp: new Date().toISOString(),
    })

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: 'buy 0.1 bitcoin' })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('trade_proposal')
    expect(res.body.proposal.symbol).toBe('BTCUSD')
    expect(res.body.proposal.type).toBe('CRYPTO')
    expect(res.body.proposal.quantity).toBeCloseTo(0.1)
    expect(vi.mocked(marketService.getPriceForAsset)).toHaveBeenCalledWith('BTCUSD', 'CRYPTO')
    expect(vi.mocked(aiService.simulationChat)).not.toHaveBeenCalled()
  })

  it('returns a crypto trade proposal for notional buy phrasing', async () => {
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'BTCUSD', price: 50000, type: 'CRYPTO', timestamp: new Date().toISOString(),
    })

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: 'Buy me 250 worth of BTC' })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('trade_proposal')
    expect(res.body.proposal.symbol).toBe('BTCUSD')
    expect(res.body.proposal.type).toBe('CRYPTO')
    expect(res.body.proposal.quantity).toBeCloseTo(0.005)
    expect(res.body.proposal.estimatedTotal).toBe(250)
    expect(vi.mocked(aiService.simulationChat)).not.toHaveBeenCalled()
  })

  it('returns a sell proposal for sell-all stock phrasing', async () => {
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 270, type: 'STOCK', timestamp: new Date().toISOString(),
    })

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: 'sell all my stock for AAPL' })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('trade_proposal')
    expect(res.body.proposal.side).toBe('SELL')
    expect(res.body.proposal.symbol).toBe('AAPL')
    expect(res.body.proposal.quantity).toBe(10)
    expect(vi.mocked(aiService.simulationChat)).not.toHaveBeenCalled()
  })

  it('returns a sell proposal for sell-all crypto phrasing', async () => {
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'BTCUSD', price: 65000, type: 'CRYPTO', timestamp: new Date().toISOString(),
    })

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: 'sell all my BTC' })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('trade_proposal')
    expect(res.body.proposal.side).toBe('SELL')
    expect(res.body.proposal.symbol).toBe('BTCUSD')
    expect(res.body.proposal.quantity).toBeCloseTo(0.5)
    expect(vi.mocked(aiService.simulationChat)).not.toHaveBeenCalled()
  })

  it('returns a portfolio graph response for natural language graph requests', async () => {
    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: 'can I get a graph' })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('graph_portfolio')
    expect(res.body.reply).toContain('portfolio value')
    expect(vi.mocked(aiService.simulationChat)).not.toHaveBeenCalled()
  })

  it('returns a portfolio graph response for plural portfolio phrasing', async () => {
    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: 'show me my portfolios graph' })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('graph_portfolio')
    expect(vi.mocked(aiService.simulationChat)).not.toHaveBeenCalled()
  })

  it('returns a portfolio graph response for portfolio value over time phrasing', async () => {
    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: 'graph my portfolio value over time' })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('graph_portfolio')
    expect(vi.mocked(aiService.simulationChat)).not.toHaveBeenCalled()
  })

  it('returns an asset graph response when the user asks with a company name', async () => {
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 270, type: 'STOCK', timestamp: new Date().toISOString(),
    })

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: 'chart Apple' })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('graph_asset')
    expect(res.body.symbol).toBe('AAPL')
    expect(res.body.type).toBe('STOCK')
    expect(vi.mocked(aiService.simulationChat)).not.toHaveBeenCalled()
  })

  it('returns an asset graph response for graph Apple phrasing', async () => {
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 270, type: 'STOCK', timestamp: new Date().toISOString(),
    })

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: 'graph Apple' })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('graph_asset')
    expect(res.body.symbol).toBe('AAPL')
    expect(res.body.type).toBe('STOCK')
    expect(vi.mocked(aiService.simulationChat)).not.toHaveBeenCalled()
  })

  it('returns a crypto graph response when the user asks with a crypto name', async () => {
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'BTCUSD', price: 65000, type: 'CRYPTO', timestamp: new Date().toISOString(),
    })

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: 'graph bitcoin' })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('graph_asset')
    expect(res.body.symbol).toBe('BTCUSD')
    expect(res.body.type).toBe('CRYPTO')
    expect(vi.mocked(aiService.simulationChat)).not.toHaveBeenCalled()
  })

  it('returns 502 when AI is unavailable', async () => {
    vi.mocked(aiService.simulationChat).mockRejectedValue(new AppError('AI unavailable', 502, 'AI_ERROR'))

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: 'Hello' })

    expect(res.status).toBe(502)
    expect(res.body.code).toBe('AI_ERROR')
    expect(typeof res.body.error).toBe('string')
  })

  it('returns 400 for empty message body', async () => {
    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/chat')
      .set('Authorization', `Bearer ${token()}`)
      .send({ message: '' })

    expect(res.status).toBe(400)
  })
})

describe('GET /api/v1/simulation/accounts/:id/ai/coach', () => {
  it('returns trade coach evaluation', async () => {
    const mockCoach: TradeCoachResponse = {
      overallGrade: 'B',
      strengths: ['Good entry timing on AAPL'],
      weaknesses: ['Position size too large relative to balance'],
      recentTradeAnalysis: [{ orderId: 'order-1', symbol: 'AAPL', assessment: 'good', reasoning: 'Bought near support.' }],
      coachingTip: 'Limit individual positions to 15% of portfolio.',
    }
    vi.mocked(aiService.tradeCoach).mockResolvedValue(mockCoach)

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/ai/coach')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(['A', 'B', 'C', 'D', 'F']).toContain(res.body.overallGrade)
    expect(Array.isArray(res.body.strengths)).toBe(true)
    expect(Array.isArray(res.body.weaknesses)).toBe(true)
    expect(Array.isArray(res.body.recentTradeAnalysis)).toBe(true)
    expect(typeof res.body.coachingTip).toBe('string')
    expect(vi.mocked(simulationService.getAccountForAIContext)).toHaveBeenCalledWith('user-1', 'acct-1')
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/simulation/accounts/acct-1/ai/coach')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/v1/simulation/accounts/:id/ai/risk', () => {
  it('returns risk assessment for a proposed trade', async () => {
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 185, type: 'STOCK', timestamp: new Date().toISOString(),
    })
    const mockRisk: RiskManagerResponse = {
      riskLevel: 'medium',
      approved: true,
      warnings: ['Position would represent 22% of portfolio'],
      positionSizePercent: 22,
      recommendation: 'Consider reducing quantity to stay under 20%.',
    }
    vi.mocked(aiService.riskManager).mockResolvedValue(mockRisk)

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/risk')
      .set('Authorization', `Bearer ${token()}`)
      .send({ symbol: 'AAPL', type: 'STOCK', side: 'BUY', quantity: 10 })

    expect(res.status).toBe(200)
    expect(['low', 'medium', 'high', 'extreme']).toContain(res.body.riskLevel)
    expect(typeof res.body.approved).toBe('boolean')
    expect(Array.isArray(res.body.warnings)).toBe(true)
    expect(typeof res.body.positionSizePercent).toBe('number')
    expect(typeof res.body.recommendation).toBe('string')
    expect(vi.mocked(simulationService.getAccountForAIContext)).toHaveBeenCalledWith('user-1', 'acct-1')
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/risk')
      .send({ symbol: 'AAPL', type: 'STOCK', side: 'BUY', quantity: 10 })
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/risk')
      .set('Authorization', `Bearer ${token()}`)
      .send({ symbol: 'AAPL' })  // missing type, side, quantity

    expect(res.status).toBe(400)
  })

  it('returns 400 when symbol is missing', async () => {
    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/ai/risk')
      .set('Authorization', `Bearer ${token()}`)
      .send({ type: 'STOCK', side: 'BUY', quantity: 10 })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/v1/simulation/accounts/:id/ai/strategy', () => {
  it('returns strategy suggestions', async () => {
    const mockStrategy: StrategyGeneratorResponse = {
      strategies: [
        {
          name: 'Momentum Trading',
          description: 'Buy assets showing strong upward momentum.',
          suitability: 'intermediate',
          expectedRisk: 'medium',
          suggestedActions: ['Screen for 52-week highs', 'Enter on pullbacks', 'Use 5% stop-loss'],
        },
      ],
      rationale: 'Your account history shows short-term trading preference.',
    }
    vi.mocked(aiService.strategyGenerator).mockResolvedValue(mockStrategy)

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/ai/strategy')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.strategies)).toBe(true)
    expect(res.body.strategies.length).toBeGreaterThan(0)
    const s = res.body.strategies[0]
    expect(typeof s.name).toBe('string')
    expect(['beginner', 'intermediate', 'advanced']).toContain(s.suitability)
    expect(['low', 'medium', 'high']).toContain(s.expectedRisk)
    expect(Array.isArray(s.suggestedActions)).toBe(true)
    expect(typeof res.body.rationale).toBe('string')
    expect(vi.mocked(simulationService.getAccountForAIContext)).toHaveBeenCalledWith('user-1', 'acct-1')
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/simulation/accounts/acct-1/ai/strategy')
    expect(res.status).toBe(401)
  })
})
