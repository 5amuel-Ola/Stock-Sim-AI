// financial-ai-backend/src/market/gemini.client.ts
import axios from 'axios'
import { AppError } from '../lib/errors'
import { logger } from '../lib/logger'
import type { Price, HistoryPoint } from './market.types'

const BASE    = 'https://api.gemini.com/v1'
const BASE_V2 = 'https://api.gemini.com/v2'

export const geminiClient = {
  async getSpotPrice(symbol: string): Promise<Price> {
    const start = Date.now()
    try {
      const { data } = await axios.get(`${BASE}/pubticker/${symbol}`)
      const price = parseFloat(data.last)
      if (!isFinite(price)) {
        throw new AppError(`Unexpected price format from Gemini for ${symbol}`, 502, 'UPSTREAM_ERROR')
      }
      logger.debug('Gemini Exchange fetch', { symbol, ms: Date.now() - start })
      return {
        symbol: symbol.toUpperCase(),
        price,
        type: 'CRYPTO',
        timestamp: new Date().toISOString(),
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('Gemini Exchange error', { symbol, message })
      throw new AppError(`Failed to fetch crypto price for ${symbol}`, 502, 'UPSTREAM_ERROR')
    }
  },

  async getHistory(symbol: string): Promise<HistoryPoint[]> {
    const start = Date.now()
    try {
      // Returns array of [timestamp_ms, open, high, low, close, volume]
      const { data } = await axios.get(`${BASE_V2}/candles/${symbol.toLowerCase()}/1day`)
      if (!Array.isArray(data)) {
        throw new AppError(`Unexpected candle data from Gemini for ${symbol}`, 502, 'UPSTREAM_ERROR')
      }
      // Sort ascending by timestamp and take last 30 days
      const sorted = (data as [number, number, number, number, number, number][])
        .sort((a, b) => a[0] - b[0])
        .slice(-30)
      const points: HistoryPoint[] = sorted.map(([ts, , , , close]) => ({
        date: new Date(ts).toISOString().split('T')[0],
        close,
      }))
      logger.debug('Gemini Exchange history', { symbol, points: points.length, ms: Date.now() - start })
      return points
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('Gemini Exchange history error', { symbol, message })
      throw new AppError(`Failed to fetch history for ${symbol}`, 502, 'UPSTREAM_ERROR')
    }
  },
}
