import { requestWithOptionalAuth } from './apiTransport'
import type { Transaction } from './types'

type SimulationPositionResponse = {
  symbol: string
  companyName: string | null
  type: 'STOCK' | 'CRYPTO'
  quantity: number
  avgCost: number
  currentPrice: number | null
  unrealizedPnL: number | null
}

type SimulationOrderResponse = {
  id: string
  symbol: string
  companyName: string | null
  assetType: 'STOCK' | 'CRYPTO'
  side: 'BUY' | 'SELL'
  orderType: 'MARKET' | 'LIMIT'
  quantity: number
  limitPrice: number | null
  fillPrice: number | null
  costBasisPerUnit: number | null
  realizedPnL: number | null
  status: 'OPEN' | 'FILLED' | 'CANCELED'
  createdAt: string
  updatedAt: string
}

export type SimulationChatResponse =
  | { kind: 'message'; reply: string }
  | {
      kind: 'trade_proposal'
      reply: string
      proposal: {
        proposalId: string
        side: 'BUY' | 'SELL'
        symbol: string
        type: 'STOCK' | 'CRYPTO'
        quantity: number
        estimatedPrice: number
        estimatedTotal: number
        projectedBalanceAfter: number
        warnings: string[]
      }
    }
  | {
      kind: 'trade_executed'
      reply: string
      execution: {
        side: 'BUY' | 'SELL'
        symbol: string
        type: 'STOCK' | 'CRYPTO'
        quantity: number
        fillPrice: number
        totalValue: number
        realizedPnL: number | null
        balanceAfter: number
      }
    }
  | { kind: 'graph_portfolio'; reply: string }
  | { kind: 'graph_asset'; reply: string; symbol: string; type: 'STOCK' | 'CRYPTO' }

export const simulationApi = {
  getSimulationAccounts() {
    return requestWithOptionalAuth<Array<{ id: string; name: string; balance: number; createdAt: string }>>('/simulation/accounts')
  },

  getSimulationAccount(accountId: string) {
    return requestWithOptionalAuth<{
      id: string
      name: string
      balance: number
      positions: SimulationPositionResponse[]
      createdAt: string
    }>(`/simulation/accounts/${accountId}`)
  },

  getPortfolioSummary(accountId: string) {
    return requestWithOptionalAuth<{
      accountId: string
      name: string
      cashBalance: number
      totalInvested: number
      currentValue: number
      unrealizedPnL: number
      totalRealizedPnL: number
      totalPnL: number
      positions: Array<{
        symbol: string
        type: string
        quantity: number
        avgCost: number
        currentPrice: number | null
        unrealizedPnL: number | null
      }>
    }>(`/simulation/accounts/${accountId}/summary`)
  },

  getTransactions(params?: { accountId?: string; symbol?: string; limit?: number; offset?: number }) {
    const qs = new URLSearchParams()
    const normalizedLimit = typeof params?.limit === 'number'
      ? Math.min(Math.max(1, params.limit), 100)
      : undefined

    if (params?.symbol) qs.set('symbol', params.symbol)
    if (normalizedLimit) qs.set('limit', String(normalizedLimit))
    if (params?.offset) qs.set('offset', String(params.offset))
    const query = qs.toString() ? `?${qs}` : ''
    return requestWithOptionalAuth<SimulationOrderResponse[]>(`/simulation/accounts/${params?.accountId}/orders${query}`)
  },

  executeTrade(accountId: string, body: { symbol: string; type: 'STOCK' | 'CRYPTO'; side: 'BUY' | 'SELL'; quantity: number; orderType?: 'MARKET' | 'LIMIT'; limitPrice?: number }) {
    return requestWithOptionalAuth('/simulation/accounts/' + accountId + '/trade', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  cancelOrder(accountId: string, orderId: string) {
    return requestWithOptionalAuth('/simulation/accounts/' + accountId + '/orders/' + orderId, {
      method: 'DELETE',
    })
  },

  executePendingOrders(accountId: string) {
    return requestWithOptionalAuth<{ filled: unknown[]; count: number }>('/simulation/accounts/' + accountId + '/orders/execute-pending', {
      method: 'POST',
    })
  },

  simulationChat(
    accountId: string,
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[] = []
  ) {
    return requestWithOptionalAuth<SimulationChatResponse>(`/simulation/accounts/${accountId}/ai/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    })
  },

  confirmChatTrade(
    accountId: string,
    proposal: {
      side: 'BUY' | 'SELL'
      symbol: string
      type: 'STOCK' | 'CRYPTO'
      quantity: number
    }
  ) {
    return requestWithOptionalAuth<SimulationChatResponse>(`/simulation/accounts/${accountId}/ai/trade/confirm`, {
      method: 'POST',
      body: JSON.stringify({ proposal }),
    })
  },
}