import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAiService } from '../ai/ai.service'
import type { AiProvider } from '../ai/ai.provider'
import type { PortfolioContext, SimulationAccountContext } from '../ai/ai.types'

const portfolio: PortfolioContext = {
  assets: [
    { symbol: 'AAPL', type: 'STOCK', quantity: 10, currentPrice: 180 },
    { symbol: 'BTC', type: 'CRYPTO', quantity: 0.5, currentPrice: 45000 },
  ],
}

const simulationAccount: SimulationAccountContext = {
  name: 'Growth',
  balance: 8200,
  positions: [
    {
      symbol: 'AAPL',
      type: 'STOCK',
      quantity: 10,
      avgCost: 175,
      currentPrice: 185,
      unrealizedPnL: 100,
    },
  ],
  recentOrders: [
    {
      orderId: 'ord-1',
      symbol: 'AAPL',
      side: 'BUY',
      quantity: 5,
      fillPrice: 180,
      totalValue: 900,
      createdAt: '2026-04-21T12:30:00.000Z',
    },
  ],
}

describe('createAiService', () => {
  let provider: AiProvider

  beforeEach(() => {
    provider = {
      chat: vi.fn(),
      structuredJson: vi.fn(),
    }
  })

  it('builds portfolio chat prompts through the provider interface', async () => {
    vi.mocked(provider.chat).mockResolvedValue('Portfolio reply')
    const service = createAiService(provider)
    const history = [{ role: 'assistant' as const, content: 'Previous portfolio answer' }]

    const result = await service.chat('What stands out?', portfolio, history)

    expect(result).toEqual({ reply: 'Portfolio reply' })
    expect(provider.chat).toHaveBeenCalledWith([
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('financial assistant helping a user manage their investment portfolio'),
      }),
      history[0],
      expect.objectContaining({
        role: 'user',
        content: 'What stands out?',
      }),
    ])
    expect(provider.chat).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ content: expect.stringContaining('AAPL (STOCK): 10 units @ $180.00 current price') }),
    ]))
  })

  it('includes live market snapshot details in the chat prompt when no portfolio exists', async () => {
    vi.mocked(provider.chat).mockResolvedValue('Market reply')
    const service = createAiService(provider)

    await service.chat('How much is AAPL worth?', {
      assets: [
        {
          symbol: 'AAPL',
          type: 'STOCK',
          quantity: 'market snapshot',
          currentPrice: 190.25,
          previousClose: 188.1,
          changePercent: 1.14,
        },
      ],
    })

    expect(provider.chat).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        content: expect.stringContaining('AAPL (STOCK): market snapshot @ $190.25 current price (+1.14% vs prev close, prev close $188.10)'),
      }),
    ]))
  })

  it('builds simulation chat prompts with account context and history', async () => {
    vi.mocked(provider.chat).mockResolvedValue('Simulation reply')
    const service = createAiService(provider)
    const history = [{ role: 'assistant' as const, content: 'Previous answer' }]

    const result = await service.simulationChat('What should I do next?', simulationAccount, history)

    expect(result).toEqual({ reply: 'Simulation reply' })
    expect(provider.chat).toHaveBeenCalledWith([
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('virtual trading simulation with real market prices'),
      }),
      history[0],
      expect.objectContaining({ role: 'user', content: 'What should I do next?' }),
    ])
    expect(provider.chat).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ content: expect.stringContaining('Cash Balance: $8200.00') }),
      expect.objectContaining({ content: expect.stringContaining('unrealized P&L $100.00') }),
    ]))
  })

  it('builds structured risk manager prompts with computed portfolio value', async () => {
    vi.mocked(provider.structuredJson).mockResolvedValue({
      riskLevel: 'medium',
      approved: true,
      warnings: [],
      positionSizePercent: 10,
      recommendation: 'Keep position sizing disciplined.',
    })
    const service = createAiService(provider)

    const result = await service.riskManager(simulationAccount, {
      symbol: 'MSFT',
      type: 'STOCK',
      side: 'BUY',
      quantity: 2,
      estimatedValue: 600,
    })

    expect(result.riskLevel).toBe('medium')
    expect(provider.structuredJson).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        role: 'user',
        content: expect.stringContaining('Total portfolio value (cash + positions at current prices): $10050.00'),
      }),
      expect.objectContaining({
        role: 'user',
        content: expect.stringContaining('"symbol":"MSFT"'),
      }),
    ]))
  })

  it('builds structured portfolio prompts for summary-style agents', async () => {
    vi.mocked(provider.structuredJson).mockResolvedValue({
      overallSentiment: 'bullish',
      assetTrends: [],
      topInsights: ['a', 'b', 'c', 'd', 'e'],
      marketOutlook: 'Constructive.',
    })
    const service = createAiService(provider)

    await service.trendAnalysis(portfolio)

    expect(provider.structuredJson).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('You are a market analyst.'),
      }),
      expect.objectContaining({
        role: 'user',
        content: expect.stringContaining("User's portfolio:"),
      }),
    ]))
  })
})