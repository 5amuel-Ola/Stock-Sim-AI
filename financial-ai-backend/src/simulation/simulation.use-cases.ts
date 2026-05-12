import { AppError } from '../lib/errors'
import { mapFilledOrder, mapSimulationRecentOrder } from './simulation.mappers'
import { getTradeExecutionStrategy } from './simulation-order-strategies'
import { ProcessOpenOrdersUseCase } from './simulation.process-open-orders.use-case'
import {
  calculateBuyPositionState,
  calculateRealizedPnL,
  calculateRemainingSellQuantity,
} from './simulation.trade-rules'
import { assertOwner, enrichFilledOrder, enrichPosition, type SimulationUseCaseDependencies } from './simulation.use-case-support'
import type {
  AccountDetail,
  AccountSummary,
  CreateAccountBody,
  FilledOrder,
  OrderQuery,
  PortfolioSummary,
  TradeBody,
} from './simulation.types'
import type { PortfolioContext, SimulationAccountContext } from '../ai/ai.types'

class CreateSimulationAccountUseCase {
  constructor(private readonly dependencies: SimulationUseCaseDependencies) {}

  async execute(userId: string, body: CreateAccountBody): Promise<AccountSummary> {
    const existing = await this.dependencies.repository.findAccountByName(userId, body.name)
    if (existing) {
      throw new AppError('Account name already in use', 409, 'ACCOUNT_NAME_TAKEN')
    }

    const account = await this.dependencies.repository.createAccount({
      userId,
      name: body.name,
      balance: body.startingBalance ?? 5000,
    })

    return { ...account, balance: Number(account.balance) }
  }
}

class GetSimulationAccountsUseCase {
  constructor(private readonly dependencies: SimulationUseCaseDependencies) {}

  async execute(userId: string): Promise<AccountSummary[]> {
    const accounts = await this.dependencies.repository.findAccountsByUser(userId)
    return accounts.map(account => ({ ...account, balance: Number(account.balance) }))
  }
}

class GetSimulationAccountUseCase {
  constructor(private readonly dependencies: SimulationUseCaseDependencies) {}

  async execute(userId: string, accountId: string): Promise<AccountDetail> {
    const account = await this.dependencies.repository.findAccountWithPositions(accountId)
    assertOwner(account, userId)

    const positions = await Promise.all(
      account!.positions.map((position: any) => enrichPosition(this.dependencies.marketPrices, position)),
    )

    return {
      id: account!.id,
      userId: account!.userId,
      name: account!.name,
      balance: Number(account!.balance),
      createdAt: account!.createdAt,
      updatedAt: account!.updatedAt,
      positions,
    }
  }
}

class DeleteSimulationAccountUseCase {
  constructor(private readonly dependencies: SimulationUseCaseDependencies) {}

  async execute(userId: string, accountId: string): Promise<void> {
    const account = await this.dependencies.repository.findAccountWithPositions(accountId)
    assertOwner(account, userId)
    await this.dependencies.repository.deleteAccount(accountId)
  }
}

class ExecuteTradeUseCase {
  constructor(private readonly dependencies: SimulationUseCaseDependencies) {}

  async execute(userId: string, accountId: string, body: TradeBody): Promise<FilledOrder> {
    const account = await this.dependencies.repository.findAccountWithSymbolPosition(accountId, body.symbol)
    assertOwner(account, userId)

    let marketPrice: number
    try {
      const priceData = await this.dependencies.marketPrices.getPriceForAsset(body.symbol, body.type)
      marketPrice = priceData.price
    } catch {
      throw new AppError('Market price unavailable for this symbol', 502, 'MARKET_PRICE_UNAVAILABLE')
    }

    const existingPosition = account!.positions[0] ?? null
    if (body.side === 'SELL') {
      if (!existingPosition) {
        throw new AppError(`No position in ${body.symbol} to sell`, 400, 'INSUFFICIENT_POSITION')
      }

      const heldQuantity = Number(existingPosition.quantity)
      if (body.quantity > heldQuantity) {
        throw new AppError(
          `Insufficient position: selling ${body.quantity}, holding ${heldQuantity}`,
          400,
          'INSUFFICIENT_POSITION',
        )
      }
    }

    const executionPlan = getTradeExecutionStrategy(body.orderType).createPlan({
      body,
      marketPrice,
      balance: Number(account!.balance),
    })

    if (executionPlan.status === 'OPEN') {
      const openOrder = await this.dependencies.repository.createOrder({
        accountId,
        symbol: body.symbol,
        assetType: body.type,
        side: body.side,
        orderType: 'LIMIT',
        quantity: body.quantity,
        limitPrice: executionPlan.limitPrice,
        fillPrice: null,
        totalValue: null,
        realizedPnL: null,
        status: 'OPEN',
      })

      return enrichFilledOrder(this.dependencies.marketPrices, openOrder)
    }

    const { fillPrice, totalValue, limitPrice, orderType } = executionPlan
    const realizedPnL = calculateRealizedPnL(body.side, existingPosition, fillPrice, body.quantity)

    const order = await this.dependencies.repository.runInTransaction(async (transaction) => {
      const newOrder = await transaction.createOrder({
        accountId,
        symbol: body.symbol,
        assetType: body.type,
        side: body.side,
        orderType,
        quantity: body.quantity,
        limitPrice,
        fillPrice,
        totalValue,
        realizedPnL,
        status: 'FILLED',
      })

      if (body.side === 'BUY') {
        await transaction.updateAccountBalance(accountId, -totalValue)
        const nextPosition = calculateBuyPositionState(existingPosition, fillPrice, body.quantity)
        await transaction.upsertPosition({
          accountId,
          symbol: body.symbol,
          type: body.type,
          quantity: nextPosition.quantity,
          avgCost: nextPosition.avgCost,
        })
      } else {
        await transaction.updateAccountBalance(accountId, totalValue)
        const remainingQuantity = calculateRemainingSellQuantity(existingPosition!, body.quantity)
        if (remainingQuantity === 0) {
          await transaction.deletePosition(accountId, body.symbol)
        } else {
          await transaction.updatePositionQuantity(accountId, body.symbol, remainingQuantity)
        }
      }

      return newOrder
    })

    return enrichFilledOrder(this.dependencies.marketPrices, order)
  }
}

class CancelOrderUseCase {
  constructor(private readonly dependencies: SimulationUseCaseDependencies) {}

  async execute(userId: string, accountId: string, orderId: string): Promise<FilledOrder> {
    const account = await this.dependencies.repository.findAccountWithPositions(accountId)
    assertOwner(account, userId)

    const order = await this.dependencies.repository.findOrderById(orderId)
    if (!order || order.accountId !== accountId) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND')
    }
    if (order.status !== 'OPEN') {
      throw new AppError('Only open orders can be canceled', 400, 'ORDER_NOT_OPEN')
    }

    const updatedOrder = await this.dependencies.repository.updateOrderStatus(orderId, 'CANCELED')
    return enrichFilledOrder(this.dependencies.marketPrices, updatedOrder)
  }
}

class GetSimulationOrdersUseCase {
  constructor(private readonly dependencies: SimulationUseCaseDependencies) {}

  async execute(userId: string, accountId: string, query: OrderQuery): Promise<FilledOrder[]> {
    const account = await this.dependencies.repository.findAccountWithPositions(accountId)
    assertOwner(account, userId)

    const orders = await this.dependencies.repository.findOrders({
      accountId,
      symbol: query.symbol,
      side: query.side,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    })

    return Promise.all(
      orders.map(order => enrichFilledOrder(this.dependencies.marketPrices, order)),
    )
  }
}

class GetAllPositionsForAiContextUseCase {
  constructor(private readonly dependencies: SimulationUseCaseDependencies) {}

  async execute(userId: string): Promise<PortfolioContext> {
    const accounts = await this.dependencies.repository.findAccountsWithPositions(userId)
    const allPositions = accounts.flatMap(account => account.positions)

    const assets = await Promise.all(
      allPositions.map(async (position: any) => {
        try {
          const price = await this.dependencies.marketPrices.getPriceForAsset(
            position.symbol,
            position.type as 'STOCK' | 'CRYPTO',
          )
          return {
            symbol: position.symbol,
            type: position.type,
            quantity: Number(position.quantity),
            currentPrice: price.price,
          }
        } catch {
          return {
            symbol: position.symbol,
            type: position.type,
            quantity: Number(position.quantity),
            currentPrice: null,
          }
        }
      }),
    )

    return { assets }
  }
}

class GetPortfolioSummaryUseCase {
  constructor(private readonly dependencies: SimulationUseCaseDependencies) {}

  async execute(userId: string, accountId: string): Promise<PortfolioSummary> {
    const account = await this.dependencies.repository.findAccountWithPositions(accountId)
    assertOwner(account, userId)

    const sellOrders = await this.dependencies.repository.findSellOrders(accountId)
    const totalRealizedPnL = sellOrders.reduce(
      (sum, order) => sum + (order.realizedPnL ? Number(order.realizedPnL) : 0),
      0,
    )

    const positions = await Promise.all(
      account!.positions.map((position: any) => enrichPosition(this.dependencies.marketPrices, position)),
    )

    const totalInvested = positions.reduce((sum, position) => sum + position.avgCost * position.quantity, 0)
    const currentValue = positions.reduce((sum, position) => {
      const price = position.currentPrice ?? position.avgCost
      return sum + price * position.quantity
    }, 0)
    const unrealizedPnL = currentValue - totalInvested

    return {
      accountId: account!.id,
      name: account!.name,
      cashBalance: Number(account!.balance),
      totalInvested,
      currentValue,
      unrealizedPnL,
      totalRealizedPnL,
      totalPnL: unrealizedPnL + totalRealizedPnL,
      positions,
    }
  }
}

class GetSimulationAccountContextUseCase {
  constructor(private readonly dependencies: SimulationUseCaseDependencies) {}

  async execute(userId: string, accountId: string): Promise<SimulationAccountContext> {
    const account = await this.dependencies.repository.findAccountWithPositions(accountId)
    assertOwner(account, userId)

    const recentOrders = await this.dependencies.repository.findRecentOrders(accountId, 10)
    const positions = await Promise.all(
      account!.positions.map((position: any) => enrichPosition(this.dependencies.marketPrices, position)),
    )

    return {
      name: account!.name,
      balance: Number(account!.balance),
      positions: positions.map(position => ({
        symbol: position.symbol,
        type: position.type,
        quantity: position.quantity,
        avgCost: position.avgCost,
        currentPrice: position.currentPrice,
        unrealizedPnL: position.unrealizedPnL,
      })),
      recentOrders: recentOrders.map(mapSimulationRecentOrder),
    }
  }
}

export interface SimulationUseCases {
  createAccount: CreateSimulationAccountUseCase
  getAccounts: GetSimulationAccountsUseCase
  getAccount: GetSimulationAccountUseCase
  deleteAccount: DeleteSimulationAccountUseCase
  executeTrade: ExecuteTradeUseCase
  cancelOrder: CancelOrderUseCase
  processOpenOrders: ProcessOpenOrdersUseCase
  getOrders: GetSimulationOrdersUseCase
  getAllPositionsForAIContext: GetAllPositionsForAiContextUseCase
  getPortfolioSummary: GetPortfolioSummaryUseCase
  getAccountForAIContext: GetSimulationAccountContextUseCase
}

export function createSimulationUseCases(dependencies: SimulationUseCaseDependencies): SimulationUseCases {
  return {
    createAccount: new CreateSimulationAccountUseCase(dependencies),
    getAccounts: new GetSimulationAccountsUseCase(dependencies),
    getAccount: new GetSimulationAccountUseCase(dependencies),
    deleteAccount: new DeleteSimulationAccountUseCase(dependencies),
    executeTrade: new ExecuteTradeUseCase(dependencies),
    cancelOrder: new CancelOrderUseCase(dependencies),
    processOpenOrders: new ProcessOpenOrdersUseCase(dependencies),
    getOrders: new GetSimulationOrdersUseCase(dependencies),
    getAllPositionsForAIContext: new GetAllPositionsForAiContextUseCase(dependencies),
    getPortfolioSummary: new GetPortfolioSummaryUseCase(dependencies),
    getAccountForAIContext: new GetSimulationAccountContextUseCase(dependencies),
  }
}