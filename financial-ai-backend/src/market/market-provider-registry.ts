import { AssetType } from '@prisma/client'
import { AppError } from '../lib/errors'
import type { MarketDataProvider } from './market.providers'

export interface MarketProviderRegistry {
  get(assetType: AssetType): MarketDataProvider
}

export function createMarketProviderRegistry(providers: MarketDataProvider[]): MarketProviderRegistry {
  const providersByAssetType = new Map(providers.map((provider) => [provider.assetType, provider]))

  return {
    get(assetType: AssetType): MarketDataProvider {
      const provider = providersByAssetType.get(assetType)
      if (!provider) {
        throw new AppError(`No market provider configured for ${assetType}`, 500, 'MARKET_PROVIDER_MISSING')
      }

      return provider
    },
  }
}