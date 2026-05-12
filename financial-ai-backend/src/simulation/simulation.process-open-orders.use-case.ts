import { marketService } from '../market/market.service'
import { prismaSimulationAccountRepository } from './simulation-account.repository'
import {
  calculateBuyPositionState,
  calculateRealizedPnL,
  calculateRemainingSellQuantity,
} from './simulation.trade-rules'
import { assertOwner, enrichFilledOrder, type SimulationUseCaseDependencies } from './simulation.use-case-support'
import type { FilledOrder } from './simulation.types'

interface ExecutableOpenOrderCandidate {
  openOrder: any
  fillPrice: number
  totalValue: number
}

export class ProcessOpenOrdersUseCase {
  constructor(private readonly dependencies: SimulationUseCaseDependencies) {}

  async execute(userId: string, accountId: string): Promise<FilledOrder[]> {
    const account = await this.dependencies.repository.findAccountWithPositions(accountId)
    assertOwner(account, userId)

    const executableOrders = await this.fetchExecutableOpenOrders(accountId)
    const filledOrders: FilledOrder[] = []

    for (const candidate of executableOrders) {
      const filledOrder = await this.fillOpenOrder(accountId, candidate)
      if (filledOrder) {
        filledOrders.push(filledOrder)
      }
    }

    return filledOrders
  }

  private async fetchExecutableOpenOrders(accountId: string): Promise<ExecutableOpenOrderCandidate[]> {
    const openOrders = await this.dependencies.repository.findOpenOrders(accountId)
    const executableOrders: ExecutableOpenOrderCandidate[] = []

    for (const openOrder of openOrders) {
      let marketPrice: number
      try {
        const priceData = await this.dependencies.marketPrices.getPriceForAsset(
          openOrder.symbol,
          openOrder.assetType as 'STOCK' | 'CRYPTO',
        )
        marketPrice = priceData.price
      } catch {
        continue
      }

      const fillPrice = Number(openOrder.limitPrice)
      const conditionMet =
        (openOrder.side === 'BUY' && marketPrice <= fillPrice) ||
        (openOrder.side === 'SELL' && marketPrice >= fillPrice)

      if (!conditionMet) {
        continue
      }

      executableOrders.push({
        openOrder,
        fillPrice,
        totalValue: Number(openOrder.quantity) * fillPrice,
      })
    }

    return executableOrders
  }

  private async fillOpenOrder(
    accountId: string,
    candidate: ExecutableOpenOrderCandidate,
  ): Promise<FilledOrder | null> {
    const freshAccount = await this.dependencies.repository.findAccountWithSymbolPosition(
      accountId,
      candidate.openOrder.symbol,
    )
    if (!freshAccount) {
      return null
    }

    const quantity = Number(candidate.openOrder.quantity)
    const balance = Number(freshAccount.balance)
    const existingPosition = freshAccount.positions[0] ?? null

    if (candidate.openOrder.side === 'BUY' && candidate.totalValue > balance) {
      return null
    }

    if (candidate.openOrder.side === 'SELL') {
      if (!existingPosition) {
        return null
      }
      if (quantity > Number(existingPosition.quantity)) {
        return null
      }
    }

    const realizedPnL = calculateRealizedPnL(
      candidate.openOrder.side,
      existingPosition,
      candidate.fillPrice,
      quantity,
    )

    const updatedOrder = await this.dependencies.repository.runInTransaction(async (transaction) => {
      const order = await transaction.updateOrder(candidate.openOrder.id, {
        fillPrice: candidate.fillPrice,
        totalValue: candidate.totalValue,
        realizedPnL,
        status: 'FILLED',
      })

      if (candidate.openOrder.side === 'BUY') {
        await transaction.updateAccountBalance(accountId, -candidate.totalValue)
        const nextPosition = calculateBuyPositionState(existingPosition, candidate.fillPrice, quantity)
        await transaction.upsertPosition({
          accountId,
          symbol: candidate.openOrder.symbol,
          type: candidate.openOrder.assetType,
          quantity: nextPosition.quantity,
          avgCost: nextPosition.avgCost,
        })
      } else {
        await transaction.updateAccountBalance(accountId, candidate.totalValue)
        const remainingQuantity = calculateRemainingSellQuantity(existingPosition!, quantity)
        if (remainingQuantity === 0) {
          await transaction.deletePosition(accountId, candidate.openOrder.symbol)
        } else {
          await transaction.updatePositionQuantity(accountId, candidate.openOrder.symbol, remainingQuantity)
        }
      }

      return order
    })

    return enrichFilledOrder(this.dependencies.marketPrices, updatedOrder)
  }
}

export const processOpenOrdersUseCase = new ProcessOpenOrdersUseCase({
  repository: prismaSimulationAccountRepository,
  marketPrices: marketService,
})