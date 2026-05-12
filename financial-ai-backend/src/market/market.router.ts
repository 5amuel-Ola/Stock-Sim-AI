// financial-ai-backend/src/market/market.router.ts
import { Router, Request, Response } from 'express'
import { marketService } from './market.service'
import { prisma } from '../lib/prisma'
import { AppError } from '../lib/errors'
import { logger } from '../lib/logger'

export const marketRouter = Router()

marketRouter.get('/search', async (req: Request, res: Response) => {
  const query = req.query.query as string | undefined
  const type = (req.query.type as string | undefined)?.toUpperCase() as 'STOCK' | 'CRYPTO' | undefined
  
  if (!query || query.trim() === '') {
    res.status(400).json({ error: 'query parameter is required' }); return
  }
  
  if (type && type !== 'STOCK' && type !== 'CRYPTO') {
    res.status(400).json({ error: 'type must be STOCK or CRYPTO' }); return
  }
  
  try {
    const results = await marketService.searchStocks(query, type)
    res.json(results)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('Stock search error', { query, type, message })
    res.status(500).json({ error: 'Stock search failed' })
  }
})

marketRouter.get('/crypto/:symbol', async (req: Request, res: Response) => {
  const price = await marketService.getCryptoPrice((req.params.symbol as string).toUpperCase())
  res.json(price)
})

marketRouter.get('/stock/:symbol', async (req: Request, res: Response) => {
  const price = await marketService.getStockPrice((req.params.symbol as string).toUpperCase())
  res.json(price)
})

marketRouter.get('/history/:symbol', async (req: Request, res: Response) => {
  const symbol = (req.params.symbol as string).toUpperCase()
  const type   = ((req.query.type as string) ?? 'STOCK').toUpperCase() as 'STOCK' | 'CRYPTO'
  if (type !== 'STOCK' && type !== 'CRYPTO') {
    res.status(400).json({ error: 'type must be STOCK or CRYPTO' }); return
  }
  const history = await marketService.getHistory(symbol, type)
  res.json(history)
})

marketRouter.get('/prices', async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const positions = await prisma.position.findMany({
    where: { account: { userId } },
    select: { symbol: true, type: true },
    distinct: ['symbol', 'type'] as import('@prisma/client').Prisma.PositionScalarFieldEnum[],
  })

  if (positions.length === 0) {
    res.json([])
    return
  }

  const prices = await Promise.allSettled(
    positions.map((a) => marketService.getPriceForAsset(a.symbol, a.type))
  )

  prices
    .filter((p) => p.status === 'rejected')
    .forEach((p) => {
      const rejection = p as PromiseRejectedResult
      const reason = rejection.reason instanceof Error ? rejection.reason.message : String(rejection.reason)
      logger.warn('Price fetch failed', { reason })
    })

  const result = prices
    .filter((p): p is PromiseFulfilledResult<Awaited<ReturnType<typeof marketService.getPriceForAsset>>> => p.status === 'fulfilled')
    .map((p) => p.value)

  res.json(result)
})
