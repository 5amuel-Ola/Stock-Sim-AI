// Fetches transaction history used to build the portfolio-value-over-time chart.

import useSWR from 'swr'
import { simulationApi } from '../lib/simulationApi'
import type { Transaction } from '../lib/types'

type RawTransaction = Awaited<ReturnType<typeof simulationApi.getTransactions>>[number]

export function useTransactions(limit = 100) {
  const { data, error, isLoading } = useSWR<RawTransaction[]>(
    `transactions:${limit}`,
    () => simulationApi.getTransactions({ limit })
  )

  const transactions: Transaction[] = (data ?? []).map(order => ({
    id: order.id,
    userId: '',
    assetId: order.symbol,
    type: order.side,
    orderType: order.orderType,
    quantity: order.quantity,
    price: order.fillPrice,
    limitPrice: order.limitPrice,
    timestamp: order.createdAt,
    realizedPnL: order.realizedPnL,
    status: order.status,
    asset: { symbol: order.symbol, type: order.assetType },
    companyName: order.companyName,
    costBasisPerUnit: order.costBasisPerUnit,
  }))

  return {
    transactions,
    error,
    isLoading,
  }
}
