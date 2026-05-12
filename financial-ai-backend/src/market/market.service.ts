// financial-ai-backend/src/market/market.service.ts
import { AssetType } from '@prisma/client'
import { createMarketProviderRegistry } from './market-provider-registry'
import { defaultMarketProviders, type MarketDataProvider } from './market.providers'
import { priceCache } from './market.types'
import { prisma } from '../lib/prisma'
import type { Price, HistoryPoint } from './market.types'
import { searchStocks as searchReferenceAssets, getStockBySymbol as getReferenceAssetBySymbol } from './stock-reference'

export function createMarketService(providers: MarketDataProvider[]) {
  const providerRegistry = createMarketProviderRegistry(providers)

  async function getCachedPrice(symbol: string, type: AssetType): Promise<Price> {
    const cacheKey = `${type.toLowerCase()}:${symbol}`
    const cached = priceCache.get(cacheKey)
    if (cached) return cached

    const price = await providerRegistry.get(type).getLatestPrice(symbol)
    priceCache.set(cacheKey, price)
    return price
  }

  return {
    getCryptoPrice(symbol: string): Promise<Price> {
      return getCachedPrice(symbol, 'CRYPTO')
    },

    getStockPrice(symbol: string): Promise<Price> {
      return getCachedPrice(symbol, 'STOCK')
    },

    getPriceForAsset(symbol: string, type: AssetType): Promise<Price> {
      return getCachedPrice(symbol, type)
    },

    getHistory(symbol: string, type: AssetType): Promise<HistoryPoint[]> {
      return providerRegistry.get(type).getHistory(symbol)
    },

    async searchStocks(query: string, type?: 'STOCK' | 'CRYPTO') {
      const q = query.toLowerCase().trim()
      if (!q) return []

      // Build Prisma query
      const where = type
        ? {
            type: type,
            OR: [
              { symbol: { contains: q, mode: 'insensitive' as const } },
              { name: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {
            OR: [
              { symbol: { contains: q, mode: 'insensitive' as const } },
              { name: { contains: q, mode: 'insensitive' as const } },
            ],
          }

      const results = await prisma.security.findMany({
        where,
        take: 20,
      })

      const referenceResults = searchReferenceAssets(query)
        .filter((asset) => !type || asset.type === type)
        .map((asset) => ({
          symbol: asset.symbol,
          name: asset.companyName,
          type: asset.type,
        }))

      const mergedResults = [...results, ...referenceResults].reduce<Array<{ symbol: string; name: string; type: 'STOCK' | 'CRYPTO' }>>((acc, item) => {
        if (!acc.some(existing => existing.symbol === item.symbol)) {
          acc.push(item)
        }
        return acc
      }, [])

      // Score and sort results
      const scored = mergedResults.map((s) => {
        const symbolLower = s.symbol.toLowerCase()
        const nameLower = s.name.toLowerCase()
        let score = 0

        if (symbolLower === q) score = 1000
        else if (nameLower === q) score = 900
        else if (symbolLower.startsWith(q)) score = 800
        else if (nameLower.startsWith(q)) score = 700
        else if (symbolLower.includes(q)) score = 600
        else if (nameLower.includes(q)) score = 500

        return { security: s, score }
      })

      // Sort by score descending, then symbol ascending
      scored.sort((a, b) => b.score - a.score || a.security.symbol.localeCompare(b.security.symbol))

      return scored.map((s) => ({
        symbol: s.security.symbol,
        companyName: s.security.name,
        type: s.security.type,
      }))
    },

    async getSecurityBySymbol(symbol: string) {
      const security = await prisma.security.findUnique({
        where: { symbol: symbol.toUpperCase() },
      })

      if (security) {
        return security
      }

      const referenceAsset = getReferenceAssetBySymbol(symbol)
      if (!referenceAsset) {
        return null
      }

      return {
        id: `reference-${referenceAsset.symbol}`,
        symbol: referenceAsset.symbol,
        name: referenceAsset.companyName,
        type: referenceAsset.type,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    },
  }
}

export const marketService = createMarketService(defaultMarketProviders)
