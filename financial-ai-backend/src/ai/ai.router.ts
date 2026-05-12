// financial-ai-backend/src/ai/ai.router.ts
import { Router, Request, Response } from 'express'
import { aiService }          from './ai.service'
import { simulationService }  from '../simulation/simulation.service'
import { marketService } from '../market/market.service'
import { validate }           from '../middleware/validate.middleware'
import { requireAuth } from '../middleware/auth.middleware'
import { chatAccessService } from './chat-access.service'
import { chatSchema, type ChatBody, type PortfolioContext } from './ai.types'

export const aiRouter = Router()

const SYMBOL_PATTERN = /\b[A-Z]{2,5}\b/g
const IGNORED_SYMBOL_TOKENS = new Set([
  'ABOUT',
  'AFTER',
  'AGAIN',
  'ALSO',
  'AND',
  'CHAT',
  'FROM',
  'HAVE',
  'HOLD',
  'INTO',
  'JUST',
  'LONG',
  'LOOK',
  'MARKET',
  'NEXT',
  'ONLY',
  'SHOULD',
  'STOCK',
  'THE',
  'THEN',
  'THIS',
  'VIEW',
  'WHAT',
  'WHEN',
  'WITH',
  'YOUR',
])
const COMMON_CRYPTO_SYMBOLS = new Set([
  'ADA',
  'ATOM',
  'AVAX',
  'BCH',
  'BNB',
  'BTC',
  'DOGE',
  'DOT',
  'ETC',
  'ETH',
  'LINK',
  'LTC',
  'MATIC',
  'SOL',
  'UNI',
  'XLM',
  'XRP',
])

function extractMentionedSymbols(message: string, history: ChatBody['history'] = []): string[] {
  const transcript = [
    ...history.map(entry => entry.content),
    message,
  ].join(' ')

  const matches = transcript.toUpperCase().match(SYMBOL_PATTERN) ?? []
  const uniqueSymbols: string[] = []

  for (const symbol of matches) {
    if (IGNORED_SYMBOL_TOKENS.has(symbol) || uniqueSymbols.includes(symbol)) {
      continue
    }

    uniqueSymbols.push(symbol)
    if (uniqueSymbols.length >= 4) {
      break
    }
  }

  return uniqueSymbols
}

async function getMarketSnapshot(symbol: string) {
  try {
    return COMMON_CRYPTO_SYMBOLS.has(symbol)
      ? await marketService.getCryptoPrice(symbol)
      : await marketService.getStockPrice(symbol)
  } catch {
    try {
      return COMMON_CRYPTO_SYMBOLS.has(symbol)
        ? await marketService.getStockPrice(symbol)
        : await marketService.getCryptoPrice(symbol)
    } catch {
      return null
    }
  }
}

async function enrichPortfolioContext(
  portfolio: PortfolioContext,
  message: string,
  history: ChatBody['history'] = [],
): Promise<PortfolioContext> {
  const symbols = extractMentionedSymbols(message, history)
  if (symbols.length === 0) {
    return portfolio
  }

  const snapshots = await Promise.all(symbols.map(getMarketSnapshot))
  const enrichedAssets = [...portfolio.assets]

  for (const snapshot of snapshots) {
    if (!snapshot) {
      continue
    }

    const existing = enrichedAssets.find(asset => asset.symbol === snapshot.symbol && asset.type === snapshot.type)
    if (existing) {
      existing.currentPrice = snapshot.price
      existing.previousClose = snapshot.previousClose ?? null
      existing.changePercent = snapshot.changePercent ?? null
      continue
    }

    enrichedAssets.push({
      symbol: snapshot.symbol,
      type: snapshot.type,
      quantity: 'market snapshot',
      currentPrice: snapshot.price,
      previousClose: snapshot.previousClose ?? null,
      changePercent: snapshot.changePercent ?? null,
    })
  }

  return { assets: enrichedAssets }
}

aiRouter.post('/chat', validate(chatSchema), async (req: Request, res: Response) => {
  const access = await chatAccessService.evaluate(req)
  if (!access.allowed) {
    res.status(403).json(chatAccessService.buildLimitPayload(access))
    return
  }

  const body = req.body as ChatBody
  const userId = req.user?.userId
  const portfolio = userId
    ? await simulationService.getAllPositionsForAIContext(userId)
    : { assets: [] }
  const enrichedPortfolio = await enrichPortfolioContext(portfolio, body.message, body.history)
  const result = await aiService.chat(body.message, enrichedPortfolio, body.history ?? [])
  res.json({
    ...result,
    isAnonymous: access.isAnonymous,
    sessionId: access.sessionId,
    messageCount: access.messageCount,
    remainingMessages: access.remainingMessages,
  })
})

aiRouter.get('/summary', requireAuth, async (req: Request, res: Response) => {
  const portfolio = await simulationService.getAllPositionsForAIContext(req.user!.userId)
  const result    = await aiService.summary(portfolio)
  res.json(result)
})

aiRouter.get('/risk-analysis', requireAuth, async (req: Request, res: Response) => {
  const portfolio = await simulationService.getAllPositionsForAIContext(req.user!.userId)
  const result    = await aiService.riskAnalysis(portfolio)
  res.json(result)
})

aiRouter.get('/trends', requireAuth, async (req: Request, res: Response) => {
  const portfolio = await simulationService.getAllPositionsForAIContext(req.user!.userId)
  const result    = await aiService.trendAnalysis(portfolio)
  res.json(result)
})

aiRouter.get('/suggestions', requireAuth, async (req: Request, res: Response) => {
  const portfolio = await simulationService.getAllPositionsForAIContext(req.user!.userId)
  const result    = await aiService.investmentSuggestions(portfolio)
  res.json(result)
})
