import type { AssetType, OrderSide, OrderStatus, OrderType } from '@prisma/client'
import { prisma } from '../lib/prisma'

export interface CreateSimulationAccountInput {
  userId: string
  name: string
  balance: number
}

export interface CreateOrderInput {
  accountId: string
  symbol: string
  assetType: AssetType
  side: OrderSide
  orderType: OrderType
  quantity: number
  limitPrice: number | null
  fillPrice: number | null
  totalValue: number | null
  realizedPnL: number | null
  status: OrderStatus
}

export interface SimulationAccountTransactionRepository {
  createOrder(input: CreateOrderInput): Promise<any>
  updateAccountBalance(accountId: string, delta: number): Promise<void>
  upsertPosition(input: {
    accountId: string
    symbol: string
    type: AssetType
    quantity: number
    avgCost: number
  }): Promise<void>
  deletePosition(accountId: string, symbol: string): Promise<void>
  updatePositionQuantity(accountId: string, symbol: string, quantity: number): Promise<void>
  updateOrder(orderId: string, data: {
    fillPrice: number
    totalValue: number
    realizedPnL: number | null
    status: OrderStatus
  }): Promise<any>
}

export interface SimulationAccountRepository {
  findAccountByName(userId: string, name: string): Promise<any>
  createAccount(input: CreateSimulationAccountInput): Promise<any>
  findAccountsByUser(userId: string): Promise<any[]>
  findAccountWithPositions(accountId: string): Promise<any>
  findAccountWithSymbolPosition(accountId: string, symbol: string): Promise<any>
  deleteAccount(accountId: string): Promise<void>
  createOrder(input: CreateOrderInput): Promise<any>
  findOrderById(orderId: string): Promise<any>
  updateOrderStatus(orderId: string, status: OrderStatus): Promise<any>
  findOpenOrders(accountId: string): Promise<any[]>
  findOrders(params: {
    accountId: string
    symbol?: string
    side?: OrderSide
    status?: OrderStatus
    limit: number
    offset: number
  }): Promise<any[]>
  findAccountsWithPositions(userId: string): Promise<any[]>
  findSellOrders(accountId: string): Promise<Array<{ realizedPnL: unknown }>>
  findRecentOrders(accountId: string, take: number): Promise<any[]>
  runInTransaction<T>(callback: (repository: SimulationAccountTransactionRepository) => Promise<T>): Promise<T>
}

function createTransactionRepository(tx: typeof prisma): SimulationAccountTransactionRepository {
  return {
    async createOrder(input) {
      return tx.order.create({ data: input })
    },

    async updateAccountBalance(accountId, delta) {
      await tx.simulationAccount.update({
        where: { id: accountId },
        data: delta >= 0
          ? { balance: { increment: delta } }
          : { balance: { decrement: Math.abs(delta) } },
      })
    },

    async upsertPosition(input) {
      await tx.position.upsert({
        where: { accountId_symbol: { accountId: input.accountId, symbol: input.symbol } },
        update: { quantity: input.quantity, avgCost: input.avgCost },
        create: input,
      })
    },

    async deletePosition(accountId, symbol) {
      await tx.position.delete({ where: { accountId_symbol: { accountId, symbol } } })
    },

    async updatePositionQuantity(accountId, symbol, quantity) {
      await tx.position.update({
        where: { accountId_symbol: { accountId, symbol } },
        data: { quantity },
      })
    },

    async updateOrder(orderId, data) {
      return tx.order.update({
        where: { id: orderId },
        data,
      })
    },
  }
}

export const prismaSimulationAccountRepository: SimulationAccountRepository = {
  findAccountByName(userId, name) {
    return prisma.simulationAccount.findUnique({
      where: { userId_name: { userId, name } },
    })
  },

  createAccount(input) {
    return prisma.simulationAccount.create({
      data: input,
    })
  },

  findAccountsByUser(userId) {
    return prisma.simulationAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
  },

  findAccountWithPositions(accountId) {
    return prisma.simulationAccount.findUnique({
      where: { id: accountId },
      include: { positions: true },
    })
  },

  findAccountWithSymbolPosition(accountId, symbol) {
    return prisma.simulationAccount.findUnique({
      where: { id: accountId },
      include: { positions: { where: { symbol } } },
    })
  },

  async deleteAccount(accountId) {
    await prisma.simulationAccount.delete({ where: { id: accountId } })
  },

  createOrder(input) {
    return prisma.order.create({ data: input })
  },

  findOrderById(orderId) {
    return prisma.order.findUnique({ where: { id: orderId } })
  },

  updateOrderStatus(orderId, status) {
    return prisma.order.update({
      where: { id: orderId },
      data: { status },
    })
  },

  findOpenOrders(accountId) {
    return prisma.order.findMany({
      where: { accountId, status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
    })
  },

  findOrders(params) {
    return prisma.order.findMany({
      where: {
        accountId: params.accountId,
        ...(params.symbol ? { symbol: params.symbol } : {}),
        ...(params.side ? { side: params.side } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: params.limit,
      skip: params.offset,
    })
  },

  findAccountsWithPositions(userId) {
    return prisma.simulationAccount.findMany({
      where: { userId },
      include: { positions: true },
    })
  },

  findSellOrders(accountId) {
    return prisma.order.findMany({
      where: { accountId, side: 'SELL' },
      select: { realizedPnL: true },
    })
  },

  findRecentOrders(accountId, take) {
    return prisma.order.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take,
    })
  },

  runInTransaction(callback) {
    return prisma.$transaction((tx) => callback(createTransactionRepository(tx as typeof prisma)))
  },
}