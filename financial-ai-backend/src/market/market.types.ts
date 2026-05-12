// financial-ai-backend/src/market/market.types.ts
import type { AssetType } from '@prisma/client'

export interface Price {
  symbol: string
  price: number
  previousClose?: number
  changePercent?: number
  type: AssetType
  timestamp: string
}

export interface HistoryPoint {
  date: string   // 'YYYY-MM-DD'
  close: number
}

interface CacheEntry {
  value: Price
  expiresAt: number
}

const store = new Map<string, CacheEntry>()
const TTL_MS = 30_000

export const priceCache = {
  get(key: string): Price | null {
    const entry = store.get(key)
    if (!entry || entry.expiresAt < Date.now()) return null
    return entry.value
  },
  set(key: string, value: Price): void {
    store.set(key, { value, expiresAt: Date.now() + TTL_MS })
  },
  clear(): void {
    store.clear()
  },
}
