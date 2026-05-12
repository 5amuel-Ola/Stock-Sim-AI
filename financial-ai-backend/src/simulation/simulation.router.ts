// financial-ai-backend/src/simulation/simulation.router.ts
import { Router, Request, Response } from 'express'
import { simulationService } from './simulation.service'
import { aiService }         from '../ai/ai.service'
import { marketService }     from '../market/market.service'
import { getStockBySymbol, searchStocks as searchStockReferences } from '../market/stock-reference'
import { validate }          from '../middleware/validate.middleware'
import { parseTradeIntent }  from '../ai/simulation-trade-intent'
import { parseGraphIntent }  from '../ai/graph-intent'
import {
  createAccountSchema, tradeSchema, orderQuerySchema, riskCheckSchema,
  type CreateAccountBody, type TradeBody, type RiskCheckBody,
} from './simulation.types'
import { simulationChatSchema, type SimulationChatBody, type TradeProposal, type SimulationChatResponse } from '../ai/ai.types'
import { z } from 'zod'

export const simulationRouter = Router()

simulationRouter.post('/accounts', validate(createAccountSchema), async (req: Request, res: Response) => {
  const account = await simulationService.createAccount(req.user!.userId, req.body as CreateAccountBody)
  res.status(201).json(account)
})

simulationRouter.get('/accounts', async (req: Request, res: Response) => {
  res.json(await simulationService.getAccounts(req.user!.userId))
})

simulationRouter.get('/accounts/:id', async (req: Request, res: Response) => {
  res.json(await simulationService.getAccount(req.user!.userId, req.params.id as string))
})

simulationRouter.delete('/accounts/:id', async (req: Request, res: Response) => {
  await simulationService.deleteAccount(req.user!.userId, req.params.id as string)
  res.status(204).send()
})

simulationRouter.post('/accounts/:id/trade', validate(tradeSchema), async (req: Request, res: Response) => {
  const order = await simulationService.executeTrade(req.user!.userId, req.params.id as string, req.body as TradeBody)
  res.status(201).json(order)
})

simulationRouter.get('/accounts/:id/orders', async (req: Request, res: Response) => {
  const parsed = orderQuerySchema.safeParse(req.query)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid query parameters' }); return }
  res.json(await simulationService.getOrders(req.user!.userId, req.params.id as string, parsed.data))
})

simulationRouter.delete('/accounts/:id/orders/:orderId', async (req: Request, res: Response) => {
  const result = await simulationService.cancelOrder(req.user!.userId, req.params.id as string, req.params.orderId as string)
  res.json(result)
})

simulationRouter.post('/accounts/:id/orders/execute-pending', async (req: Request, res: Response) => {
  const filled = await simulationService.processOpenOrders(req.user!.userId, req.params.id as string)
  res.json({ filled, count: filled.length })
})

simulationRouter.get('/accounts/:id/summary', async (req: Request, res: Response) => {
  res.json(await simulationService.getPortfolioSummary(req.user!.userId, req.params.id as string))
})

simulationRouter.post('/accounts/:id/ai/chat', validate(simulationChatSchema), async (req: Request, res: Response) => {
  const body = req.body as SimulationChatBody
  const ctx  = await simulationService.getAccountForAIContext(req.user!.userId, req.params.id as string)

  // Check for direct trade intent
  const tradeIntent = parseTradeIntent(body.message)
  if (tradeIntent) {
    try {
      const resolvedTradeIntent = resolveTradeIntentSymbol(tradeIntent)

      // Fetch current market price
      const priceData = await marketService.getPriceForAsset(resolvedTradeIntent.symbol, resolvedTradeIntent.type)
      const currentPrice = priceData.price
      const resolvedQuantity = resolveTradeIntentQuantity(resolvedTradeIntent, currentPrice, ctx.positions)
      const estimatedTotal = resolvedTradeIntent.notionalUsd ?? currentPrice * resolvedQuantity

      // Validation for proposal-level checks
      if (resolvedTradeIntent.side === 'BUY') {
        if (estimatedTotal > ctx.balance) {
          // Fail gracefully: return as normal message error
          const response: SimulationChatResponse = {
            kind: 'message',
            reply: `Insufficient funds. You need $${estimatedTotal.toFixed(2)} to buy ${resolvedQuantity} ${resolvedTradeIntent.symbol}, but you only have $${ctx.balance.toFixed(2)} available.`,
          }
          res.json(response)
          return
        }
      } else if (resolvedTradeIntent.side === 'SELL') {
        const position = ctx.positions.find(p => p.symbol === resolvedTradeIntent.symbol)
        if (!position || position.quantity < resolvedQuantity) {
          const available = position?.quantity ?? 0
          const response: SimulationChatResponse = {
            kind: 'message',
            reply: `Cannot sell ${resolvedQuantity} ${resolvedTradeIntent.symbol}. You only have ${available} units.`,
          }
          res.json(response)
          return
        }
      }

      // Build proposal
      const projectedBalanceAfter = resolvedTradeIntent.side === 'BUY'
        ? ctx.balance - estimatedTotal
        : ctx.balance + estimatedTotal

      const proposal: TradeProposal = {
        proposalId: `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        side: resolvedTradeIntent.side,
        symbol: resolvedTradeIntent.symbol,
        type: resolvedTradeIntent.type,
        quantity: resolvedQuantity,
        estimatedPrice: currentPrice,
        estimatedTotal,
        projectedBalanceAfter,
        warnings: [],
      }

      const response: SimulationChatResponse = {
        kind: 'trade_proposal',
        reply: `I can place that trade. Review the estimate below and confirm if you want to proceed.`,
        proposal,
      }
      res.json(response)
      return
    } catch (error) {
      // If market price fetch fails, fall through to normal AI chat
    }
  }

  // Check for graph visualization intent
  const graphIntent = parseGraphIntent(body.message)
  if (graphIntent) {
    if (graphIntent.kind === 'portfolio_graph') {
      const response: SimulationChatResponse = {
        kind: 'graph_portfolio',
        reply: 'Here\'s your portfolio value over time.',
      }
      res.json(response)
      return
    } else if (graphIntent.kind === 'asset_graph' && graphIntent.symbol) {
      const resolvedAsset = resolveGraphAssetSymbol(graphIntent.symbol)
      let assetType: 'STOCK' | 'CRYPTO' = resolvedAsset.type
      let assetSymbol = resolvedAsset.symbol

      const ownedAsset = ctx.positions.find(position => position.symbol === assetSymbol)
      if (ownedAsset) {
        assetType = ownedAsset.type as 'STOCK' | 'CRYPTO'
        assetSymbol = ownedAsset.symbol
      }

      try {
        await marketService.getPriceForAsset(assetSymbol, assetType)
      } catch {
        assetType = assetSymbol.endsWith('USD') ? 'CRYPTO' : assetType
      }

      const response: SimulationChatResponse = {
        kind: 'graph_asset',
        reply: `Here's the price performance chart for ${assetSymbol}.`,
        symbol: assetSymbol,
        type: assetType,
      }
      res.json(response)
      return
    }
  }

  // Normal AI chat
  const response = await aiService.simulationChat(body.message, ctx, body.history ?? [])
  res.json(response)
})

function resolveTradeIntentSymbol(tradeIntent: {
  side: 'BUY' | 'SELL'
  symbol: string
  type: 'STOCK' | 'CRYPTO'
  quantity?: number
  notionalUsd?: number
  sellAll?: boolean
}) {
  const resolvedAsset = resolveReferencedAsset(tradeIntent.symbol)
  if (!resolvedAsset) {
    return tradeIntent
  }

  return {
    ...tradeIntent,
    symbol: resolvedAsset.symbol,
    type: resolvedAsset.type,
  }
}

function resolveGraphAssetSymbol(symbol: string) {
  const normalizedSymbol = symbol.toUpperCase()
  const resolvedAsset = resolveReferencedAsset(normalizedSymbol)
  if (resolvedAsset) {
    return resolvedAsset
  }

  return {
    symbol: normalizedSymbol,
    type: normalizedSymbol.endsWith('USD') ? 'CRYPTO' as const : 'STOCK' as const,
  }
}

function resolveReferencedAsset(symbol: string) {
  const normalizedSymbol = symbol.toUpperCase()
  const directMatch = getStockBySymbol(normalizedSymbol)
  if (directMatch) {
    return {
      symbol: directMatch.symbol,
      type: directMatch.type,
    }
  }

  const matches = searchStockReferences(normalizedSymbol)
  const topMatch = matches[0]
  if (!topMatch) {
    return null
  }

  const queryLower = normalizedSymbol.toLowerCase()
  const queryUpper = normalizedSymbol.toUpperCase()
  const companyName = topMatch.companyName.toLowerCase()
  const confidentCompanyMatch = queryLower.length >= 3 && companyName.startsWith(queryLower)
  const confidentSymbolMatch = topMatch.symbol === queryUpper || topMatch.symbol.startsWith(queryUpper)

  if (!confidentCompanyMatch && !confidentSymbolMatch) {
    return null
  }

  return {
    symbol: topMatch.symbol,
    type: topMatch.type,
  }
}

function resolveTradeIntentQuantity(tradeIntent: {
  quantity?: number
  notionalUsd?: number
  sellAll?: boolean
  symbol: string
  type: 'STOCK' | 'CRYPTO'
}, currentPrice: number, positions: Array<{ symbol: string; quantity: number }>) {
  if (tradeIntent.sellAll) {
    const position = positions.find(item => item.symbol === tradeIntent.symbol)
    return position?.quantity ?? 0
  }

  if (tradeIntent.notionalUsd != null) {
    const quantityFromNotional = tradeIntent.notionalUsd / currentPrice
    return tradeIntent.type === 'CRYPTO'
      ? Number(quantityFromNotional.toFixed(8))
      : Math.floor(quantityFromNotional)
  }

  return tradeIntent.quantity ?? 0
}

simulationRouter.get('/accounts/:id/ai/coach', async (req: Request, res: Response) => {
  const ctx = await simulationService.getAccountForAIContext(req.user!.userId, req.params.id as string)
  res.json(await aiService.tradeCoach(ctx))
})

simulationRouter.post('/accounts/:id/ai/risk', validate(riskCheckSchema), async (req: Request, res: Response) => {
  const ctx  = await simulationService.getAccountForAIContext(req.user!.userId, req.params.id as string)
  const body = req.body as RiskCheckBody
  let estimatedValue = 0
  try {
    const price = await marketService.getPriceForAsset(body.symbol, body.type)
    estimatedValue = body.quantity * price.price
  } catch { /* pass 0 if price unavailable */ }
  res.json(await aiService.riskManager(ctx, { ...body, estimatedValue }))
})

simulationRouter.get('/accounts/:id/ai/strategy', async (req: Request, res: Response) => {
  const ctx = await simulationService.getAccountForAIContext(req.user!.userId, req.params.id as string)
  res.json(await aiService.strategyGenerator(ctx))
})

// Trade confirmation endpoint: executes a proposed trade from chat
const confirmTradeSchema = z.object({
  proposal: z.object({
    side: z.enum(['BUY', 'SELL']),
    symbol: z.string().toUpperCase(),
    type: z.enum(['STOCK', 'CRYPTO']),
    quantity: z.number().positive().finite(),
  }),
})

simulationRouter.post('/accounts/:id/ai/trade/confirm', validate(confirmTradeSchema), async (req: Request, res: Response) => {
  const proposal = (req.body as z.infer<typeof confirmTradeSchema>).proposal

  try {
    const execution = await simulationService.confirmChatTrade(
      req.user!.userId,
      req.params.id as string,
      proposal,
    )

    const response: SimulationChatResponse = {
      kind: 'trade_executed',
      reply: `${proposal.side === 'BUY' ? 'Bought' : 'Sold'} ${proposal.quantity} ${proposal.symbol} at $${execution.fillPrice.toFixed(2)}.`,
      execution,
    }
    res.status(201).json(response)
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Trade execution failed'
    const response: SimulationChatResponse = {
      kind: 'message',
      reply: `Trade failed: ${errorMsg}`,
    }
    res.status(400).json(response)
  }
})
