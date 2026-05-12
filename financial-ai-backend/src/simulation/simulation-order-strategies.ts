import { AppError } from '../lib/errors'
import type { TradeBody } from './simulation.types'

export interface TradeExecutionContext {
  body: TradeBody
  marketPrice: number
  balance: number
}

export type TradeExecutionPlan =
  | {
      status: 'OPEN'
      orderType: 'LIMIT'
      limitPrice: number
      fillPrice: null
      totalValue: null
    }
  | {
      status: 'FILLED'
      orderType: 'MARKET' | 'LIMIT'
      limitPrice: number | null
      fillPrice: number
      totalValue: number
    }

export interface TradeExecutionStrategy {
  createPlan(context: TradeExecutionContext): TradeExecutionPlan
}

const marketOrderStrategy: TradeExecutionStrategy = {
  createPlan({ body, marketPrice, balance }) {
    const totalValue = body.quantity * marketPrice

    if (body.side === 'BUY' && totalValue > balance) {
      throw new AppError(
        `Insufficient funds: need $${totalValue.toFixed(2)}, have $${balance.toFixed(2)}`,
        400,
        'INSUFFICIENT_FUNDS',
      )
    }

    return {
      status: 'FILLED',
      orderType: 'MARKET',
      limitPrice: null,
      fillPrice: marketPrice,
      totalValue,
    }
  },
}

const limitOrderStrategy: TradeExecutionStrategy = {
  createPlan({ body, marketPrice, balance }) {
    const limitPrice = body.limitPrice!
    const conditionMet =
      (body.side === 'BUY' && marketPrice <= limitPrice) ||
      (body.side === 'SELL' && marketPrice >= limitPrice)

    if (!conditionMet) {
      if (body.side === 'BUY') {
        const estimatedCost = body.quantity * limitPrice
        if (estimatedCost > balance) {
          throw new AppError(
            `Insufficient funds: need $${estimatedCost.toFixed(2)}, have $${balance.toFixed(2)}`,
            400,
            'INSUFFICIENT_FUNDS',
          )
        }
      }

      return {
        status: 'OPEN',
        orderType: 'LIMIT',
        limitPrice,
        fillPrice: null,
        totalValue: null,
      }
    }

    return {
      status: 'FILLED',
      orderType: 'LIMIT',
      limitPrice,
      fillPrice: limitPrice,
      totalValue: body.quantity * limitPrice,
    }
  },
}

const tradeExecutionStrategies: Record<TradeBody['orderType'], TradeExecutionStrategy> = {
  MARKET: marketOrderStrategy,
  LIMIT: limitOrderStrategy,
}

export function getTradeExecutionStrategy(orderType: TradeBody['orderType']): TradeExecutionStrategy {
  return tradeExecutionStrategies[orderType]
}