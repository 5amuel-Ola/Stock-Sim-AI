// financial-ai-backend/src/test/simulation.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import 'express-async-errors'
import jwt from 'jsonwebtoken'
import { simulationRouter } from '../simulation/simulation.router'
import { errorHandler }     from '../middleware/error.middleware'
import { authenticate }     from '../middleware/auth.middleware'
import { prisma }           from '../lib/prisma'

const app = express()
app.use(express.json())
app.use('/api/v1/simulation', authenticate, simulationRouter)
app.use(errorHandler)

const JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!'
const token = (userId = 'user-1') => jwt.sign({ userId }, JWT_SECRET)

vi.mock('../market/market.service', () => ({
  marketService: { getPriceForAsset: vi.fn(), getSecurityBySymbol: vi.fn() },
}))

vi.mock('../ai/ai.service', () => ({
  aiService: {
    simulationChat: vi.fn(), tradeCoach: vi.fn(),
    riskManager: vi.fn(), strategyGenerator: vi.fn(),
    chat: vi.fn(), summary: vi.fn(),
    riskAnalysis: vi.fn(), trendAnalysis: vi.fn(), investmentSuggestions: vi.fn(),
  },
}))

import { marketService } from '../market/market.service'

function makeDecimal(n: number) {
  return { toNumber: () => n, toString: () => String(n) }
}

const mockAccount = {
  id: 'acct-1', userId: 'user-1', name: 'Test Account',
  balance: makeDecimal(5000), createdAt: new Date(), updatedAt: new Date(),
}

describe('POST /api/v1/simulation/accounts', () => {
  it('creates an account with default balance', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(null)
    ;(prisma as any).simulationAccount.create.mockResolvedValue({
      ...mockAccount,
      balance: makeDecimal(5000),
    })
    const res = await request(app)
      .post('/api/v1/simulation/accounts')
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'Test Account' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Test Account')
    expect(res.body.balance).toBe(5000)
  })

  it('creates an account with custom startingBalance', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(null)
    ;(prisma as any).simulationAccount.create.mockResolvedValue({ ...mockAccount, balance: makeDecimal(5000) })
    const res = await request(app)
      .post('/api/v1/simulation/accounts')
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'Small Account', startingBalance: 5000 })
    expect(res.status).toBe(201)
    expect(res.body.balance).toBe(5000)
  })

  it('returns 409 for duplicate account name', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(mockAccount)
    const res = await request(app)
      .post('/api/v1/simulation/accounts')
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'Test Account' })
    expect(res.status).toBe(409)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/simulation/accounts').send({ name: 'Test' })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/v1/simulation/accounts', () => {
  it('returns all accounts for the user', async () => {
    ;(prisma as any).simulationAccount.findMany.mockResolvedValue([mockAccount])
    const res = await request(app)
      .get('/api/v1/simulation/accounts')
      .set('Authorization', `Bearer ${token()}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].name).toBe('Test Account')
  })
})

describe('GET /api/v1/simulation/accounts/:id', () => {
  it('returns account detail with empty positions', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({ ...mockAccount, positions: [] })
    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1')
      .set('Authorization', `Bearer ${token()}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe('acct-1')
    expect(Array.isArray(res.body.positions)).toBe(true)
  })

  it('returns company names for stock positions when the security reference exists', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({
      ...mockAccount,
      positions: [{
        id: 'pos-1', accountId: 'acct-1', symbol: 'AAPL', type: 'STOCK',
        quantity: makeDecimal(2), avgCost: makeDecimal(170), createdAt: new Date(), updatedAt: new Date(),
      }],
    })
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 185, type: 'STOCK', timestamp: new Date().toISOString(),
    })
    vi.mocked(marketService.getSecurityBySymbol as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', name: 'Apple Inc.', type: 'STOCK',
    })

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body.positions[0].companyName).toBe('Apple Inc.')
  })

  it('returns 404 for account owned by another user', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({ ...mockAccount, userId: 'other', positions: [] })
    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1')
      .set('Authorization', `Bearer ${token('user-1')}`)
    expect(res.status).toBe(404)
  })

  it('returns 404 for non-existent account', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(null)
    const res = await request(app)
      .get('/api/v1/simulation/accounts/bad-id')
      .set('Authorization', `Bearer ${token()}`)
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/v1/simulation/accounts/:id', () => {
  it('deletes account and returns 204', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(mockAccount)
    ;(prisma as any).simulationAccount.delete.mockResolvedValue(mockAccount)
    const res = await request(app)
      .delete('/api/v1/simulation/accounts/acct-1')
      .set('Authorization', `Bearer ${token()}`)
    expect(res.status).toBe(204)
  })

  it('returns 404 for account owned by another user', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({ ...mockAccount, userId: 'other' })
    const res = await request(app)
      .delete('/api/v1/simulation/accounts/acct-1')
      .set('Authorization', `Bearer ${token()}`)
    expect(res.status).toBe(404)
  })
})

describe('POST /api/v1/simulation/accounts/:id/trade', () => {
  const accountWithBalance = { ...mockAccount, positions: [] }
  const filledOrder = {
    id: 'order-1', accountId: 'acct-1', symbol: 'AAPL', assetType: 'STOCK', side: 'BUY',
    orderType: 'MARKET', quantity: makeDecimal(10), limitPrice: null,
    fillPrice: makeDecimal(180), totalValue: makeDecimal(1800),
    realizedPnL: null, status: 'FILLED', createdAt: new Date(), updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.mocked(prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma))
  })

  it('executes a BUY order and returns filled order', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(accountWithBalance)
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 180, type: 'STOCK', timestamp: new Date().toISOString(),
    })
    ;(prisma as any).order.create.mockResolvedValue(filledOrder)
    ;(prisma as any).simulationAccount.update.mockResolvedValue({})
    ;(prisma as any).position.upsert.mockResolvedValue({})
    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/trade')
      .set('Authorization', `Bearer ${token()}`)
      .send({ symbol: 'AAPL', type: 'STOCK', side: 'BUY', quantity: 10 })
    expect(res.status).toBe(201)
    expect(res.body.symbol).toBe('AAPL')
    expect(res.body.fillPrice).toBe(180)
    expect(res.body.status).toBe('FILLED')
  })

  it('executes a SELL order for an existing position', async () => {
    const accountWithPosition = {
      ...mockAccount,
      positions: [{
        id: 'pos-1', accountId: 'acct-1', symbol: 'AAPL', type: 'STOCK',
        quantity: makeDecimal(10), avgCost: makeDecimal(170),
        createdAt: new Date(), updatedAt: new Date(),
      }],
    }
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(accountWithPosition)
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 185, type: 'STOCK', timestamp: new Date().toISOString(),
    })
    ;(prisma as any).order.create.mockResolvedValue({ ...filledOrder, side: 'SELL' })
    ;(prisma as any).simulationAccount.update.mockResolvedValue({})
    ;(prisma as any).position.update.mockResolvedValue({})
    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/trade')
      .set('Authorization', `Bearer ${token()}`)
      .send({ symbol: 'AAPL', type: 'STOCK', side: 'SELL', quantity: 10 })
    expect(res.status).toBe(201)
    expect(res.body.side).toBe('SELL')
  })

  it('returns 400 for insufficient funds on BUY', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({ ...mockAccount, balance: makeDecimal(100), positions: [] })
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 180, type: 'STOCK', timestamp: new Date().toISOString(),
    })
    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/trade')
      .set('Authorization', `Bearer ${token()}`)
      .send({ symbol: 'AAPL', type: 'STOCK', side: 'BUY', quantity: 10 })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INSUFFICIENT_FUNDS')
  })

  it('returns 400 for insufficient position on SELL', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(accountWithBalance)
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 180, type: 'STOCK', timestamp: new Date().toISOString(),
    })
    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/trade')
      .set('Authorization', `Bearer ${token()}`)
      .send({ symbol: 'AAPL', type: 'STOCK', side: 'SELL', quantity: 5 })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INSUFFICIENT_POSITION')
  })

  it('returns 502 when market price is unavailable', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(accountWithBalance)
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('timeout'))
    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/trade')
      .set('Authorization', `Bearer ${token()}`)
      .send({ symbol: 'AAPL', type: 'STOCK', side: 'BUY', quantity: 10 })
    expect(res.status).toBe(502)
    expect(res.body.code).toBe('MARKET_PRICE_UNAVAILABLE')
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/trade')
      .send({ symbol: 'AAPL', type: 'STOCK', side: 'BUY', quantity: 10 })
    expect(res.status).toBe(401)
  })

  it('creates an OPEN limit BUY order when the market price is above the limit', async () => {
    const openLimitOrder = {
      id: 'order-open-1', accountId: 'acct-1', symbol: 'AAPL', assetType: 'STOCK', side: 'BUY',
      orderType: 'LIMIT', quantity: makeDecimal(2), limitPrice: makeDecimal(150),
      fillPrice: null, totalValue: null, realizedPnL: null,
      status: 'OPEN', createdAt: new Date(), updatedAt: new Date(),
    }

    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(accountWithBalance)
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 180, type: 'STOCK', timestamp: new Date().toISOString(),
    })
    ;(prisma as any).order.create.mockResolvedValue(openLimitOrder)

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/trade')
      .set('Authorization', `Bearer ${token()}`)
      .send({ symbol: 'AAPL', type: 'STOCK', side: 'BUY', quantity: 2, orderType: 'LIMIT', limitPrice: 150 })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('OPEN')
    expect(res.body.orderType).toBe('LIMIT')
    expect(res.body.limitPrice).toBe(150)
    expect(res.body.fillPrice).toBeNull()
    expect(res.body.totalValue).toBeNull()
    expect((prisma as any).simulationAccount.update).not.toHaveBeenCalled()
    expect((prisma as any).position.upsert).not.toHaveBeenCalled()
  })
})

describe('GET /api/v1/simulation/accounts/:id/orders', () => {
  const mockOrder = {
    id: 'order-1', accountId: 'acct-1', symbol: 'AAPL', assetType: 'STOCK', side: 'BUY',
    orderType: 'MARKET', quantity: makeDecimal(10), limitPrice: null,
    fillPrice: makeDecimal(180), totalValue: makeDecimal(1800),
    realizedPnL: null, status: 'FILLED', createdAt: new Date(), updatedAt: new Date(),
  }

  it('returns paginated order history', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(mockAccount)
    ;(prisma as any).order.findMany.mockResolvedValue([mockOrder])
    vi.mocked(marketService.getSecurityBySymbol as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', name: 'Apple Inc.', type: 'STOCK',
    })
    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/orders')
      .set('Authorization', `Bearer ${token()}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].symbol).toBe('AAPL')
    expect(res.body[0].fillPrice).toBe(180)
    expect(res.body[0].companyName).toBe('Apple Inc.')
    expect(res.body[0].costBasisPerUnit).toBe(180)
  })

  it('derives cost basis per unit for filled SELL rows', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(mockAccount)
    ;(prisma as any).order.findMany.mockResolvedValue([{
      ...mockOrder,
      side: 'SELL',
      quantity: makeDecimal(2),
      fillPrice: makeDecimal(150),
      realizedPnL: makeDecimal(20),
    }])
    vi.mocked(marketService.getSecurityBySymbol as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', name: 'Apple Inc.', type: 'STOCK',
    })

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/orders')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body[0].costBasisPerUnit).toBe(140)
  })

  it('filters by symbol query param', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(mockAccount)
    ;(prisma as any).order.findMany.mockResolvedValue([mockOrder])
    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/orders?symbol=aapl')
      .set('Authorization', `Bearer ${token()}`)
    expect(res.status).toBe(200)
    expect(res.body[0].symbol).toBe('AAPL')
  })

  it('filters by status query param', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(mockAccount)
    ;(prisma as any).order.findMany.mockResolvedValue([{ ...mockOrder, status: 'OPEN' }])

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/orders?status=open')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body[0].status).toBe('OPEN')
    expect((prisma as any).order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'OPEN' }),
    }))
  })

  it('returns 404 for account owned by another user', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({ ...mockAccount, userId: 'other' })
    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/orders')
      .set('Authorization', `Bearer ${token()}`)
    expect(res.status).toBe(404)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/simulation/accounts/acct-1/orders')
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/v1/simulation/accounts/:id/orders/:orderId', () => {
  it('cancels an open order and returns the updated DTO', async () => {
    const openOrder = {
      id: 'order-open-1', accountId: 'acct-1', symbol: 'AAPL', assetType: 'STOCK', side: 'BUY',
      orderType: 'LIMIT', quantity: makeDecimal(2), limitPrice: makeDecimal(150),
      fillPrice: null, totalValue: null, realizedPnL: null,
      status: 'OPEN', createdAt: new Date(), updatedAt: new Date(),
    }

    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue(mockAccount)
    ;(prisma as any).order.findUnique.mockResolvedValue(openOrder)
    ;(prisma as any).order.update.mockResolvedValue({ ...openOrder, status: 'CANCELED' })

    const res = await request(app)
      .delete('/api/v1/simulation/accounts/acct-1/orders/order-open-1')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('CANCELED')
    expect(res.body.orderType).toBe('LIMIT')
  })
})

describe('POST /api/v1/simulation/accounts/:id/orders/execute-pending', () => {
  beforeEach(() => {
    vi.mocked(prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma))
  })

  it('fills eligible open limit orders and returns count plus filled orders', async () => {
    const accountWithPosition = {
      ...mockAccount,
      positions: [{
        id: 'pos-1', accountId: 'acct-1', symbol: 'AAPL', type: 'STOCK',
        quantity: makeDecimal(5), avgCost: makeDecimal(140), createdAt: new Date(), updatedAt: new Date(),
      }],
    }
    const openSellOrder = {
      id: 'order-open-2', accountId: 'acct-1', symbol: 'AAPL', assetType: 'STOCK', side: 'SELL',
      orderType: 'LIMIT', quantity: makeDecimal(2), limitPrice: makeDecimal(150),
      fillPrice: null, totalValue: null, realizedPnL: null,
      status: 'OPEN', createdAt: new Date(), updatedAt: new Date(),
    }
    const filledOrder = {
      ...openSellOrder,
      fillPrice: makeDecimal(150),
      totalValue: makeDecimal(300),
      realizedPnL: makeDecimal(20),
      status: 'FILLED',
    }

    ;(prisma as any).simulationAccount.findUnique
      .mockResolvedValueOnce(accountWithPosition)
      .mockResolvedValueOnce(accountWithPosition)
    ;(prisma as any).order.findMany.mockResolvedValue([openSellOrder])
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 155, type: 'STOCK', timestamp: new Date().toISOString(),
    })
    ;(prisma as any).order.update.mockResolvedValue(filledOrder)
    ;(prisma as any).simulationAccount.update.mockResolvedValue({})
    ;(prisma as any).position.update.mockResolvedValue({})

    const res = await request(app)
      .post('/api/v1/simulation/accounts/acct-1/orders/execute-pending')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body.count).toBe(1)
    expect(res.body.filled).toHaveLength(1)
    expect(res.body.filled[0].status).toBe('FILLED')
    expect(res.body.filled[0].fillPrice).toBe(150)
  })
})

describe('GET /api/v1/simulation/accounts/:id/summary', () => {
  const mockPosition = {
    id: 'pos-1', accountId: 'acct-1', symbol: 'AAPL', type: 'STOCK',
    quantity: makeDecimal(2), avgCost: makeDecimal(100),
    createdAt: new Date(), updatedAt: new Date(),
  }

  const mockSellOrder = {
    id: 'ord-1', accountId: 'acct-1', symbol: 'MSFT', assetType: 'STOCK',
    side: 'SELL', quantity: makeDecimal(1), fillPrice: makeDecimal(200),
    totalValue: makeDecimal(200), realizedPnL: makeDecimal(50),
    status: 'FILLED', createdAt: new Date(), updatedAt: new Date(),
  }

  it('returns portfolio summary with all computed fields', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({
      ...mockAccount, positions: [mockPosition],
    })
    ;(prisma as any).order.findMany.mockResolvedValue([mockSellOrder])
    ;(marketService.getPriceForAsset as any).mockResolvedValue({ price: 150 })

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/summary')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body.cashBalance).toBe(5000)         // mockAccount balance (now 5000)
    expect(res.body.totalInvested).toBe(200)         // 2 * 100
    expect(res.body.currentValue).toBe(300)          // 2 * 150
    expect(res.body.unrealizedPnL).toBe(100)         // 300 - 200
    expect(res.body.totalRealizedPnL).toBe(50)       // from sell order
    expect(res.body.totalPnL).toBe(150)              // 100 + 50
    expect(Array.isArray(res.body.positions)).toBe(true)
  })

  it('handles no positions and no sell orders', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({
      ...mockAccount, positions: [],
    })
    ;(prisma as any).order.findMany.mockResolvedValue([])

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/summary')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body.totalInvested).toBe(0)
    expect(res.body.currentValue).toBe(0)
    expect(res.body.totalRealizedPnL).toBe(0)
    expect(res.body.totalPnL).toBe(0)
  })

  it('falls back to avgCost when market price unavailable', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({
      ...mockAccount, positions: [mockPosition],
    })
    ;(prisma as any).order.findMany.mockResolvedValue([])
    ;(marketService.getPriceForAsset as any).mockRejectedValue(new Error('unavailable'))

    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/summary')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body.currentValue).toBe(200)   // falls back to 2 * 100 avgCost
    expect(res.body.unrealizedPnL).toBe(0)    // avgCost - avgCost = 0
  })

  it('returns 404 for wrong owner', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({
      ...mockAccount, userId: 'other-user', positions: [],
    })
    const res = await request(app)
      .get('/api/v1/simulation/accounts/acct-1/summary')
      .set('Authorization', `Bearer ${token('user-1')}`)
    expect(res.status).toBe(404)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/simulation/accounts/acct-1/summary')
    expect(res.status).toBe(401)
  })
})
