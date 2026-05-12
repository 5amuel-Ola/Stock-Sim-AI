// financial-ai-backend/src/test/market.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import 'express-async-errors'
import jwt from 'jsonwebtoken'
import { marketRouter } from '../market/market.router'
import { errorHandler } from '../middleware/error.middleware'
import { authenticate } from '../middleware/auth.middleware'
import { priceCache } from '../market/market.types'
import { prisma } from '../lib/prisma'

const app = express()
app.use(express.json())
app.use('/api/v1/market', authenticate, marketRouter)
app.use(errorHandler)

const JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!'
const token = jwt.sign({ userId: 'user-1' }, JWT_SECRET)

vi.mock('../market/gemini.client', () => ({
  geminiClient: { getSpotPrice: vi.fn() },
}))

vi.mock('../market/alpaca.client', () => ({
  alpacaClient: { getLatestQuote: vi.fn() },
}))

vi.mock('../market/yahoo.client', () => ({
  yahooClient: { getLatestQuote: vi.fn(), getHistory: vi.fn() },
}))

beforeEach(() => {
  priceCache.clear()
})

describe('GET /api/v1/market/crypto/:symbol', () => {
  it('returns price for valid symbol', async () => {
    const { geminiClient } = await import('../market/gemini.client')
    ;(geminiClient.getSpotPrice as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'BTCUSD',
      price: 65000,
      type: 'CRYPTO',
      timestamp: new Date().toISOString(),
    })

    const res = await request(app)
      .get('/api/v1/market/crypto/BTCUSD')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.symbol).toBe('BTCUSD')
    expect(res.body.price).toBe(65000)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/market/crypto/BTCUSD')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/v1/market/stock/:symbol', () => {
  it('returns price for valid symbol via Yahoo Finance', async () => {
    const { yahooClient } = await import('../market/yahoo.client')
    ;(yahooClient.getLatestQuote as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL',
      price: 185.5,
      type: 'STOCK',
      timestamp: new Date().toISOString(),
    })

    const res = await request(app)
      .get('/api/v1/market/stock/AAPL')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.symbol).toBe('AAPL')
    expect(res.body.price).toBe(185.5)
  })

  it('falls back to Alpaca when Yahoo Finance latest quote fails', async () => {
    const { yahooClient } = await import('../market/yahoo.client')
    const { alpacaClient } = await import('../market/alpaca.client')

    ;(yahooClient.getLatestQuote as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Yahoo Finance unavailable'))
    ;(alpacaClient.getLatestQuote as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL',
      price: 184.75,
      type: 'STOCK',
      timestamp: new Date().toISOString(),
    })

    const res = await request(app)
      .get('/api/v1/market/stock/AAPL')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.symbol).toBe('AAPL')
    expect(res.body.price).toBe(184.75)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/market/stock/AAPL')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/v1/market/search', () => {
  it('returns ranked company-name matches from the security reference source', async () => {
    ;(prisma as any).security.findMany.mockResolvedValue([
      { symbol: 'GME', name: 'GameStop Corp.', type: 'STOCK' },
      { symbol: 'AAPL', name: 'Apple Inc.', type: 'STOCK' },
    ])

    const res = await request(app)
      .get('/api/v1/market/search?query=apple&type=stock')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([
      { symbol: 'AAPL', companyName: 'Apple Inc.', type: 'STOCK' },
      { symbol: 'GME', companyName: 'GameStop Corp.', type: 'STOCK' },
    ])
  })

  it('returns 400 when query is missing', async () => {
    const res = await request(app)
      .get('/api/v1/market/search')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })

  it('returns crypto name matches from fallback references when the database has no crypto entries', async () => {
    ;(prisma as any).security.findMany.mockResolvedValue([])

    const res = await request(app)
      .get('/api/v1/market/search?query=bitcoin&type=crypto')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body[0]).toEqual({ symbol: 'BTCUSD', companyName: 'Bitcoin', type: 'CRYPTO' })
  })
})

describe('GET /api/v1/market/prices', () => {
  it('returns prices for all user assets', async () => {
    const mock = prisma as any
    mock.position.findMany.mockResolvedValue([
      { symbol: 'BTCUSD', type: 'CRYPTO' },
      { symbol: 'AAPL',   type: 'STOCK' },
    ])

    const { geminiClient } = await import('../market/gemini.client')
    const { yahooClient }  = await import('../market/yahoo.client')
    ;(geminiClient.getSpotPrice as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'BTCUSD', price: 65000, type: 'CRYPTO', timestamp: new Date().toISOString(),
    })
    ;(yahooClient.getLatestQuote as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL', price: 185.5, type: 'STOCK', timestamp: new Date().toISOString(),
    })

    const res = await request(app)
      .get('/api/v1/market/prices')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body.map((p: { symbol: string }) => p.symbol)).toContain('BTCUSD')
    expect(res.body.map((p: { symbol: string }) => p.symbol)).toContain('AAPL')
  })

  it('returns only successfully fetched prices when some fail', async () => {
    ;(prisma as any).position.findMany.mockResolvedValue([
      { symbol: 'BTCUSD', type: 'CRYPTO' },
      { symbol: 'AAPL',   type: 'STOCK' },
    ])

    const { geminiClient } = await import('../market/gemini.client')
    const { yahooClient }  = await import('../market/yahoo.client')
    const { alpacaClient } = await import('../market/alpaca.client')
    ;(geminiClient.getSpotPrice as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'BTCUSD', price: 65000, type: 'CRYPTO', timestamp: new Date().toISOString(),
    })
    ;(yahooClient.getLatestQuote as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Yahoo Finance unavailable'))
    ;(alpacaClient.getLatestQuote as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Alpaca unavailable'))

    const res = await request(app)
      .get('/api/v1/market/prices')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].symbol).toBe('BTCUSD')
  })

  it('returns empty array when user has no assets', async () => {
    ;(prisma as any).position.findMany.mockResolvedValue([])

    const res = await request(app)
      .get('/api/v1/market/prices')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/market/prices')
    expect(res.status).toBe(401)
  })
})
