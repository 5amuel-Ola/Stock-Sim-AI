// financial-ai-backend/src/simulation/simulation.service.ts
import { prismaSimulationAccountRepository } from './simulation-account.repository'
import { marketService } from '../market/market.service'
import { createSimulationUseCases } from './simulation.use-cases'
import type {
  CreateAccountBody,
  TradeBody,
  OrderQuery,
  AccountSummary,
  AccountDetail,
  FilledOrder,
  PortfolioSummary,
} from './simulation.types'
import type { PortfolioContext, SimulationAccountContext, TradeExecutionSummary } from '../ai/ai.types'

const simulationUseCases = createSimulationUseCases({
  repository: prismaSimulationAccountRepository,
  marketPrices: marketService,
})

export const simulationService = {
  async createAccount(userId: string, body: CreateAccountBody): Promise<AccountSummary> {
    return simulationUseCases.createAccount.execute(userId, body)
  },

  async getAccounts(userId: string): Promise<AccountSummary[]> {
    return simulationUseCases.getAccounts.execute(userId)
  },

  async getAccount(userId: string, accountId: string): Promise<AccountDetail> {
    return simulationUseCases.getAccount.execute(userId, accountId)
  },

  async deleteAccount(userId: string, accountId: string): Promise<void> {
    return simulationUseCases.deleteAccount.execute(userId, accountId)
  },

  async executeTrade(userId: string, accountId: string, body: TradeBody): Promise<FilledOrder> {
    return simulationUseCases.executeTrade.execute(userId, accountId, body)
  },

  async cancelOrder(userId: string, accountId: string, orderId: string): Promise<FilledOrder> {
    return simulationUseCases.cancelOrder.execute(userId, accountId, orderId)
  },

  async processOpenOrders(userId: string, accountId: string): Promise<FilledOrder[]> {
    return simulationUseCases.processOpenOrders.execute(userId, accountId)
  },

  async getOrders(userId: string, accountId: string, query: OrderQuery): Promise<FilledOrder[]> {
    return simulationUseCases.getOrders.execute(userId, accountId, query)
  },

  async getAllPositionsForAIContext(userId: string): Promise<PortfolioContext> {
    return simulationUseCases.getAllPositionsForAIContext.execute(userId)
  },

  async buyStock(
    userId: string,
    accountId: string,
    symbol: string,
    type: 'STOCK' | 'CRYPTO',
    quantity: number,
  ): Promise<FilledOrder> {
    return simulationUseCases.executeTrade.execute(userId, accountId, {
      symbol,
      type,
      side: 'BUY',
      quantity,
      orderType: 'MARKET',
    })
  },

  async sellStock(
    userId: string,
    accountId: string,
    symbol: string,
    type: 'STOCK' | 'CRYPTO',
    quantity: number,
  ): Promise<FilledOrder> {
    return simulationUseCases.executeTrade.execute(userId, accountId, {
      symbol,
      type,
      side: 'SELL',
      quantity,
      orderType: 'MARKET',
    })
  },

  async getPortfolioSummary(userId: string, accountId: string): Promise<PortfolioSummary> {
    return simulationUseCases.getPortfolioSummary.execute(userId, accountId)
  },

  async getAccountForAIContext(userId: string, accountId: string): Promise<SimulationAccountContext> {
    return simulationUseCases.getAccountForAIContext.execute(userId, accountId)
  },

  async confirmChatTrade(
    userId: string,
    accountId: string,
    proposal: {
      side: 'BUY' | 'SELL'
      symbol: string
      type: 'STOCK' | 'CRYPTO'
      quantity: number
    },
  ): Promise<TradeExecutionSummary> {
    // Execute the trade through the existing engine
    const filledOrder = await simulationUseCases.executeTrade.execute(userId, accountId, {
      symbol: proposal.symbol,
      type: proposal.type,
      side: proposal.side,
      quantity: proposal.quantity,
      orderType: 'MARKET',
    })

    // Fetch updated account state
    const summary = await simulationUseCases.getPortfolioSummary.execute(userId, accountId)

    // Build execution summary with actual fill values
    // Note: A successfully filled MARKET order should always have fillPrice and totalValue
    return {
      side: proposal.side,
      symbol: proposal.symbol,
      type: proposal.type,
      quantity: proposal.quantity,
      fillPrice: filledOrder.fillPrice ?? 0,
      totalValue: filledOrder.totalValue ?? 0,
      realizedPnL: filledOrder.realizedPnL ?? null,
      balanceAfter: summary.cashBalance,
    }
  },
}
