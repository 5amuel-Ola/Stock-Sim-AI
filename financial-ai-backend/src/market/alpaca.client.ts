// financial-ai-backend/src/market/alpaca.client.ts
import axios from 'axios'
import { config } from '../lib/config'
import { AppError } from '../lib/errors'
import { logger } from '../lib/logger'
import type { Price } from './market.types'

const BASE = 'https://data.alpaca.markets/v2'

const headers = () => ({
  'APCA-API-KEY-ID': config.ALPACA_KEY,
  'APCA-API-SECRET-KEY': config.ALPACA_SECRET,
})

export const alpacaClient = {
  async getLatestQuote(symbol: string): Promise<Price> {
    const start = Date.now()
    try {
      const { data } = await axios.get(
        `${BASE}/stocks/${symbol}/quotes/latest`,
        { headers: headers() }
      )
      const { ap, bp } = data.quote
      if (!isFinite(ap) || !isFinite(bp) || ap <= 0 || bp <= 0) {
        throw new AppError(`Invalid quote data from Alpaca for ${symbol}`, 502, 'UPSTREAM_ERROR')
      }
      const midpoint = (ap + bp) / 2
      logger.debug('Alpaca fetch', { symbol, ms: Date.now() - start })
      return {
        symbol: symbol.toUpperCase(),
        price: midpoint,
        type: 'STOCK',
        timestamp: new Date().toISOString(),
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('Alpaca error', { symbol, message })
      throw new AppError(`Failed to fetch stock price for ${symbol}`, 502, 'UPSTREAM_ERROR')
    }
  },
}
