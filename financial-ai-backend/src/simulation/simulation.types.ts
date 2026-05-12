// financial-ai-backend/src/simulation/simulation.types.ts
import { z } from 'zod'

// ── Request schemas ─────────────────────────────────────────────

export const createAccountSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  startingBalance: z.number().positive().optional(),
})

export const tradeSchema = z.object({
  symbol: z.string().min(1).transform(v => v.toUpperCase()),
  type: z.enum(['STOCK', 'CRYPTO']),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive(),
  orderType: z.enum(['MARKET', 'LIMIT']).default('MARKET'),
  limitPrice: z.number().positive().optional(),
}).refine(
  data => data.orderType !== 'LIMIT' || data.limitPrice != null,
  { message: 'limitPrice is required for LIMIT orders', path: ['limitPrice'] },
)

export const orderQuerySchema = z.object({
  symbol: z.string().transform(v => v.toUpperCase()).optional(),
  side: z.string().transform(v => v.toUpperCase()).pipe(z.enum(['BUY', 'SELL'])).optional(),
  status: z.string().transform(v => v.toUpperCase()).pipe(z.enum(['OPEN', 'FILLED', 'CANCELED'])).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const riskCheckSchema = z.object({
  symbol: z.string().min(1).transform(v => v.toUpperCase()),
  type: z.enum(['STOCK', 'CRYPTO']),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive(),
})

export type CreateAccountBody = z.infer<typeof createAccountSchema>
export type TradeBody         = z.infer<typeof tradeSchema>
export type OrderQuery        = z.infer<typeof orderQuerySchema>
export type RiskCheckBody     = z.infer<typeof riskCheckSchema>

// ── Response types ──────────────────────────────────────────────
// These interfaces describe the SERIALIZED service layer output — Decimal fields
// from Prisma are converted to number (via Number()) before these types are applied.

export interface EnrichedPosition {
  id: string
  accountId: string
  symbol: string
  companyName: string | null
  type: string
  quantity: number
  avgCost: number
  currentPrice: number | null
  unrealizedPnL: number | null
  createdAt: Date
  updatedAt: Date
}

export interface AccountSummary {
  id: string
  userId: string
  name: string
  balance: number
  createdAt: Date
  updatedAt: Date
}

export interface AccountDetail extends AccountSummary {
  positions: EnrichedPosition[]
}

export interface FilledOrder {
  id: string
  accountId: string
  symbol: string
  companyName: string | null
  assetType: string
  side: string
  orderType: string
  quantity: number
  limitPrice: number | null
  fillPrice: number | null
  costBasisPerUnit: number | null
  totalValue: number | null
  realizedPnL: number | null
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface PortfolioSummary {
  accountId:        string
  name:             string
  cashBalance:      number        // uninvested cash remaining in the account
  totalInvested:    number        // sum of (avgCost * quantity) across all open positions
  currentValue:     number        // sum of (currentPrice * quantity) across all open positions
  unrealizedPnL:    number        // currentValue - totalInvested (paper gain/loss on open positions)
  totalRealizedPnL: number        // sum of all realizedPnL from SELL orders on this account
  totalPnL:         number        // unrealizedPnL + totalRealizedPnL (full performance picture)
  positions:        EnrichedPosition[]
}
