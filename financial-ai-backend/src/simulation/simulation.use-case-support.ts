import { marketService } from '../market/market.service'
import { AppError } from '../lib/errors'
import type { SimulationAccountRepository } from './simulation-account.repository'
import { mapFilledOrder } from './simulation.mappers'
import type { FilledOrder } from './simulation.types'
import type { EnrichedPosition } from './simulation.types'

export type SimulationMarketPriceReader = Pick<typeof marketService, 'getPriceForAsset' | 'getSecurityBySymbol'>

export interface SimulationUseCaseDependencies {
  repository: SimulationAccountRepository
  marketPrices: SimulationMarketPriceReader
}

export function assertOwner(account: { userId: string } | null, userId: string) {
  if (!account || account.userId !== userId) {
    throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND')
  }
}

async function resolveCompanyName(
  marketPrices: SimulationMarketPriceReader,
  symbol: string,
  type: string,
): Promise<string | null> {
  if (type !== 'STOCK') {
    return null
  }

  try {
    const security = await marketPrices.getSecurityBySymbol(symbol)
    return security?.name ?? null
  } catch {
    return null
  }
}

export async function enrichPosition(
  marketPrices: SimulationMarketPriceReader,
  position: {
    id: string
    accountId: string
    symbol: string
    type: string
    quantity: { toNumber(): number }
    avgCost: { toNumber(): number }
    createdAt: Date
    updatedAt: Date
  },
): Promise<EnrichedPosition> {
  const quantity = position.quantity.toNumber()
  const avgCost = position.avgCost.toNumber()
  const companyName = await resolveCompanyName(marketPrices, position.symbol, position.type)

  try {
    const price = await marketPrices.getPriceForAsset(position.symbol, position.type as 'STOCK' | 'CRYPTO')
    return {
      id: position.id,
      accountId: position.accountId,
      symbol: position.symbol,
      companyName,
      type: position.type,
      quantity,
      avgCost,
      currentPrice: price.price,
      unrealizedPnL: (price.price - avgCost) * quantity,
      createdAt: position.createdAt,
      updatedAt: position.updatedAt,
    }
  } catch {
    return {
      id: position.id,
      accountId: position.accountId,
      symbol: position.symbol,
      companyName,
      type: position.type,
      quantity,
      avgCost,
      currentPrice: null,
      unrealizedPnL: null,
      createdAt: position.createdAt,
      updatedAt: position.updatedAt,
    }
  }
}

export async function enrichFilledOrder(
  marketPrices: SimulationMarketPriceReader,
  order: {
    id: string
    accountId: string
    symbol: string
    assetType: string
    side: string
    orderType?: string | null
    quantity: unknown
    limitPrice: unknown
    fillPrice: unknown
    totalValue: unknown
    realizedPnL: unknown
    status: string
    createdAt: Date
    updatedAt: Date
  },
): Promise<FilledOrder> {
  const companyName = await resolveCompanyName(marketPrices, order.symbol, order.assetType)
  return mapFilledOrder(order, { companyName })
}