import useSWR from 'swr'
import { simulationApi } from '../lib/simulationApi'
import type { Asset, Transaction } from '../lib/types'

export const simulationKeys = {
  accounts: ['simulation-accounts'] as const,
  accountDetails: (accountId: string) => ['simulation-account', accountId] as const,
  orders: (accountId: string, limit: number) => ['simulation-orders', accountId, limit] as const,
}

// Get the user's default simulation account (first account, auto-created at login)
export function useSimulationContext() {
  const { data: accounts, isLoading: accountsLoading, error: accountsError } = useSWR(
    simulationKeys.accounts,
    () => simulationApi.getSimulationAccounts(),
    { revalidateOnFocus: false }
  )

  const defaultAccount = accounts?.[0]

  // Fetch the account details (with positions and current prices)
  const { data: accountDetails, error: detailsError, mutate } = useSWR(
    defaultAccount ? simulationKeys.accountDetails(defaultAccount.id) : null,
    () => defaultAccount ? simulationApi.getSimulationAccount(defaultAccount.id) : null,
    { refreshInterval: 30_000 }
  )

  // Convert positions to Asset format for compatibility with existing components
  const assets: Asset[] = (accountDetails?.positions ?? []).map(pos => ({
    id: `${accountDetails?.id}-${pos.symbol}`,
    symbol: pos.symbol,
    companyName: pos.companyName ?? null,
    type: pos.type,
    quantity: pos.quantity,
    averageCost: pos.avgCost,
    currentPrice: pos.currentPrice,
    userId: '',
    priceTimestamp: null,
    createdAt: '',
    updatedAt: '',
  })) ?? []

  return {
    accountId: defaultAccount?.id,
    account: defaultAccount,
    accountDetails,
    assets,
    balance: accountDetails?.balance ?? 0,
    isLoading: accountsLoading,
    error: accountsError || detailsError,
    refresh: mutate,
  }
}

export function useSimulationAccount() {
  return useSimulationContext()
}

// Get orders (transactions) for an explicit simulation account
export function useSimulationOrders(accountId?: string, limit: number = 100) {

  const { data: rawOrders, error, isLoading, mutate } = useSWR(
    accountId ? simulationKeys.orders(accountId, limit) : null,
    () => accountId ? simulationApi.getTransactions({ accountId, limit }) : Promise.resolve([]),
    { refreshInterval: 30_000 }
  )

  // Map simulation orders to Transaction format for compatibility
  const transactions: Transaction[] = (rawOrders ?? []).map(order => ({
    id: order.id,
    userId: '',
    assetId: `${accountId}-${order.symbol}`,
    type: order.side as 'BUY' | 'SELL',
    orderType: order.orderType ?? 'MARKET',
    quantity: order.quantity,
    price: order.fillPrice ?? null,
    limitPrice: order.limitPrice ?? null,
    timestamp: order.createdAt,
    realizedPnL: order.realizedPnL ?? null,
    status: order.status ?? 'FILLED',
    asset: { symbol: order.symbol, type: order.assetType },
    companyName: order.companyName ?? null,
    costBasisPerUnit: order.costBasisPerUnit ?? null,
  })) ?? []

  return {
    transactions,
    isLoading,
    error,
    refresh: mutate,
  }
}

