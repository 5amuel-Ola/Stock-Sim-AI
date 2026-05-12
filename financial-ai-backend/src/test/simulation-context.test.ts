import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../lib/prisma'

vi.mock('../market/market.service', () => ({
  marketService: { getPriceForAsset: vi.fn() },
}))

import { marketService } from '../market/market.service'
import { simulationService } from '../simulation/simulation.service'

function makeDecimal(n: number) {
  return { toNumber: () => n, toString: () => String(n) }
}

describe('simulationService.getAccountForAIContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the stable SimulationAccountContext DTO shape with number fields and ISO dates', async () => {
    ;(prisma as any).simulationAccount.findUnique.mockResolvedValue({
      id: 'acct-1',
      userId: 'user-1',
      name: 'Growth',
      balance: makeDecimal(8200),
      createdAt: new Date(),
      updatedAt: new Date(),
      positions: [{
        id: 'pos-1',
        accountId: 'acct-1',
        symbol: 'AAPL',
        type: 'STOCK',
        quantity: makeDecimal(10),
        avgCost: makeDecimal(180),
        createdAt: new Date('2026-04-20T10:00:00.000Z'),
        updatedAt: new Date('2026-04-20T10:00:00.000Z'),
      }],
    })
    ;(prisma as any).order.findMany.mockResolvedValue([{
      id: 'ord-1',
      accountId: 'acct-1',
      symbol: 'AAPL',
      side: 'BUY',
      quantity: makeDecimal(2),
      fillPrice: makeDecimal(185),
      totalValue: makeDecimal(370),
      createdAt: new Date('2026-04-21T12:30:00.000Z'),
    }])
    vi.mocked(marketService.getPriceForAsset as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL',
      price: 190,
      type: 'STOCK',
      timestamp: new Date().toISOString(),
    })

    const context = await simulationService.getAccountForAIContext('user-1', 'acct-1')

    expect(context).toEqual({
      name: 'Growth',
      balance: 8200,
      positions: [{
        symbol: 'AAPL',
        type: 'STOCK',
        quantity: 10,
        avgCost: 180,
        currentPrice: 190,
        unrealizedPnL: 100,
      }],
      recentOrders: [{
        orderId: 'ord-1',
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 2,
        fillPrice: 185,
        totalValue: 370,
        createdAt: '2026-04-21T12:30:00.000Z',
      }],
    })
  })
})
