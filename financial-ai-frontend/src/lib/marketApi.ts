import { requestWithOptionalAuth } from './apiTransport'
import type { MarketSearchResult } from './types'

export const marketApi = {
  searchStocks(query: string, type?: 'STOCK' | 'CRYPTO') {
    const qs = new URLSearchParams()
    qs.set('query', query)
    if (type) qs.set('type', type)
    return requestWithOptionalAuth<MarketSearchResult[]>(`/market/search?${qs.toString()}`)
  },

  getStockPrice(symbol: string) {
    return requestWithOptionalAuth<{ symbol: string; price: number; previousClose?: number; changePercent?: number; type: string; timestamp: string }>(
      `/market/stock/${symbol}`
    )
  },

  getCryptoPrice(symbol: string) {
    return requestWithOptionalAuth<{ symbol: string; price: number; previousClose?: number; changePercent?: number; type: string; timestamp: string }>(
      `/market/crypto/${symbol}`
    )
  },

  getMarketHistory(symbol: string, type: 'STOCK' | 'CRYPTO') {
    return requestWithOptionalAuth<Array<{ date: string; close: number }>>(
      `/market/history/${symbol}?type=${type}`
    )
  },
}