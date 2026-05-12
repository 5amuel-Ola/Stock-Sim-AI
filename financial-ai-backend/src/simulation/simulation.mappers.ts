import type { SimulationAccountContext } from '../ai/ai.types'
import type { FilledOrder } from './simulation.types'

interface FilledOrderSource {
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
}

interface RecentOrderSource {
  id: string
  symbol: string
  side: string
  quantity: unknown
  fillPrice: unknown
  totalValue: unknown
  createdAt: Date
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null
  return Number(value)
}

function deriveCostBasisPerUnit(order: FilledOrderSource): number | null {
  const fillPrice = toNullableNumber(order.fillPrice)
  if (fillPrice == null) return null

  if (order.side !== 'SELL') {
    return fillPrice
  }

  const realizedPnL = toNullableNumber(order.realizedPnL)
  const quantity = Number(order.quantity)
  if (realizedPnL == null || !Number.isFinite(quantity) || quantity <= 0) {
    return null
  }

  return fillPrice - realizedPnL / quantity
}

export function mapFilledOrder(
  order: FilledOrderSource,
  options?: { companyName?: string | null },
): FilledOrder {
  return {
    id: order.id,
    accountId: order.accountId,
    symbol: order.symbol,
    companyName: options?.companyName ?? null,
    assetType: order.assetType,
    side: order.side,
    orderType: order.orderType ?? 'MARKET',
    quantity: Number(order.quantity),
    limitPrice: toNullableNumber(order.limitPrice),
    fillPrice: toNullableNumber(order.fillPrice),
    costBasisPerUnit: deriveCostBasisPerUnit(order),
    totalValue: toNullableNumber(order.totalValue),
    realizedPnL: toNullableNumber(order.realizedPnL),
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }
}

export function mapSimulationRecentOrder(
  order: RecentOrderSource,
): SimulationAccountContext['recentOrders'][number] {
  return {
    orderId: order.id,
    symbol: order.symbol,
    side: order.side,
    quantity: Number(order.quantity),
    fillPrice: Number(order.fillPrice),
    totalValue: Number(order.totalValue),
    createdAt: order.createdAt.toISOString(),
  }
}