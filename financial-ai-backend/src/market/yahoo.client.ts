// financial-ai-backend/src/market/yahoo.client.ts
// Uses Yahoo Finance's public chart API — no API key required.
// Endpoint: https://query1.finance.yahoo.com/v8/finance/chart/{symbol}

import axios from 'axios'
import { AppError } from '../lib/errors'
import { logger } from '../lib/logger'
import type { Price, HistoryPoint } from './market.types'

const BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'

// Yahoo Finance returns 403 without a browser-like User-Agent
const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
}

export const yahooClient = {
  async getLatestQuote(symbol: string): Promise<Price> {
    const start = Date.now()
    try {
      const { data } = await axios.get(
        `${BASE}/${symbol}?interval=1d&range=5d`,
        { headers: REQUEST_HEADERS }
      )

      if (data?.chart?.error) {
        throw new AppError(
          `Yahoo Finance error for ${symbol}: ${data.chart.error.description}`,
          502,
          'UPSTREAM_ERROR'
        )
      }

      const meta = data?.chart?.result?.[0]?.meta
      const price: unknown = meta?.regularMarketPrice
      if (typeof price !== 'number' || !isFinite(price) || price <= 0) {
        throw new AppError(
          `Invalid price data from Yahoo Finance for ${symbol}`,
          502,
          'UPSTREAM_ERROR'
        )
      }

      const previousClose: number | undefined =
        typeof meta?.chartPreviousClose === 'number' ? meta.chartPreviousClose
        : typeof meta?.previousClose === 'number'    ? meta.previousClose
        : undefined
      const changePercent =
        previousClose != null && previousClose > 0
          ? ((price - previousClose) / previousClose) * 100
          : undefined

      logger.debug('Yahoo Finance fetch', { symbol, ms: Date.now() - start })
      return {
        symbol: symbol.toUpperCase(),
        price,
        previousClose,
        changePercent,
        type: 'STOCK',
        timestamp: new Date().toISOString(),
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('Yahoo Finance error', { symbol, message })
      throw new AppError(`Failed to fetch stock price for ${symbol}`, 502, 'UPSTREAM_ERROR')
    }
  },

  async getHistory(symbol: string, range: '1mo' | '3mo' | '6mo' = '1mo'): Promise<HistoryPoint[]> {
    const start = Date.now()
    try {
      const { data } = await axios.get(
        `${BASE}/${symbol}?interval=1d&range=${range}`,
        { headers: REQUEST_HEADERS }
      )

      if (data?.chart?.error) {
        throw new AppError(
          `Yahoo Finance error for ${symbol}: ${data.chart.error.description}`,
          502,
          'UPSTREAM_ERROR'
        )
      }

      const result = data?.chart?.result?.[0]
      const timestamps: number[] = result?.timestamp ?? []
      const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? []

      const points: HistoryPoint[] = []
      for (let i = 0; i < timestamps.length; i++) {
        const close = closes[i]
        if (typeof close === 'number' && isFinite(close) && close > 0) {
          const d = new Date(timestamps[i] * 1000)
          points.push({ date: d.toISOString().split('T')[0], close })
        }
      }

      logger.debug('Yahoo Finance history', { symbol, range, points: points.length, ms: Date.now() - start })
      return points
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('Yahoo Finance history error', { symbol, message })
      throw new AppError(`Failed to fetch history for ${symbol}`, 502, 'UPSTREAM_ERROR')
    }
  },
}
