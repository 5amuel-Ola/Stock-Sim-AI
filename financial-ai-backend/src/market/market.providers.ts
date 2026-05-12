import type { AssetType } from '@prisma/client'
import { logger } from '../lib/logger'
import { alpacaClient } from './alpaca.client'
import { geminiClient } from './gemini.client'
import { yahooClient } from './yahoo.client'
import type { HistoryPoint, Price } from './market.types'

export interface MarketDataProvider {
  readonly assetType: AssetType
  getLatestPrice(symbol: string): Promise<Price>
  getHistory(symbol: string): Promise<HistoryPoint[]>
}

interface LatestPriceProvider {
  readonly name?: string
  readonly assetType: AssetType
  getLatestPrice(symbol: string): Promise<Price>
}

interface HistoryProvider {
  readonly name?: string
  readonly assetType: AssetType
  getHistory(symbol: string): Promise<HistoryPoint[]>
}

function createFallbackLatestPriceProvider(
  assetType: AssetType,
  providers: LatestPriceProvider[]
): LatestPriceProvider {
  return {
    name: `${assetType.toLowerCase()}-latest-price-fallback`,
    assetType,
    async getLatestPrice(symbol: string): Promise<Price> {
      let lastError: unknown

      for (const provider of providers) {
        try {
          return await provider.getLatestPrice(symbol)
        } catch (error: unknown) {
          lastError = error
          logger.warn('Market latest-price provider failed, trying fallback', {
            assetType,
            symbol,
            provider: provider.name ?? provider.assetType,
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }

      throw lastError
    },
  }
}

function createMarketDataProvider(
  assetType: AssetType,
  latestPriceProviders: LatestPriceProvider[],
  historyProvider: HistoryProvider
): MarketDataProvider {
  const latestPriceProvider = createFallbackLatestPriceProvider(assetType, latestPriceProviders)

  return {
    assetType,
    getLatestPrice(symbol: string): Promise<Price> {
      return latestPriceProvider.getLatestPrice(symbol)
    },
    getHistory(symbol: string): Promise<HistoryPoint[]> {
      return historyProvider.getHistory(symbol)
    },
  }
}

const geminiMarketProvider: MarketDataProvider = {
  assetType: 'CRYPTO',
  getLatestPrice(symbol: string) {
    return geminiClient.getSpotPrice(symbol)
  },
  getHistory(symbol: string) {
    return geminiClient.getHistory(symbol)
  },
}

const yahooStockPriceProvider: LatestPriceProvider = {
  name: 'yahoo-stock-price-provider',
  assetType: 'STOCK',
  getLatestPrice(symbol: string) {
    return yahooClient.getLatestQuote(symbol)
  },
}

const alpacaStockPriceProvider: LatestPriceProvider = {
  name: 'alpaca-stock-price-provider',
  assetType: 'STOCK',
  getLatestPrice(symbol: string) {
    return alpacaClient.getLatestQuote(symbol)
  },
}

const yahooStockHistoryProvider: HistoryProvider = {
  name: 'yahoo-stock-history-provider',
  assetType: 'STOCK',
  getHistory(symbol: string) {
    return yahooClient.getHistory(symbol)
  },
}

export const cryptoMarketProvider = createMarketDataProvider(
  'CRYPTO',
  [geminiMarketProvider],
  geminiMarketProvider
)

export const stockMarketProvider = createMarketDataProvider(
  'STOCK',
  [yahooStockPriceProvider, alpacaStockPriceProvider],
  yahooStockHistoryProvider
)

export const defaultMarketProviders: MarketDataProvider[] = [
  stockMarketProvider,
  cryptoMarketProvider,
]