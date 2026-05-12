// financial-ai-backend/src/ai/ai.types.ts
import { z } from 'zod'

export const chatHistoryEntrySchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(4000),
})

export const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(chatHistoryEntrySchema).max(40).optional(),
})

export type ChatBody = z.infer<typeof chatSchema>
export type ChatHistoryEntry = z.infer<typeof chatHistoryEntrySchema>

export interface PortfolioContext {
  assets: Array<{
    symbol: string
    type: string
    quantity: string | number
    currentPrice: number | null
    previousClose?: number | null
    changePercent?: number | null
  }>
}

export interface ChatResponse {
  reply: string
  sessionId?: string
  isAnonymous?: boolean
  messageCount?: number
  remainingMessages?: number
}

export interface SummaryResponse {
  summary: string
}

// --- OpenAI agent response types ---

export interface RiskAnalysisResponse {
  riskLevel: 'low' | 'medium' | 'high'
  diversificationScore: number // 1–10, 10 = most diversified
  concentrationWarnings: string[]
  sectorExposure: Record<string, number> // sector name → % of portfolio
  totalPortfolioValue: number
  recommendation: string
}

export interface AssetTrend {
  symbol: string
  trend: 'bullish' | 'bearish' | 'neutral'
  reasoning: string
}

export interface TrendAnalysisResponse {
  overallSentiment: 'bullish' | 'bearish' | 'neutral'
  assetTrends: AssetTrend[]
  topInsights: string[]
  marketOutlook: string
}

export interface Suggestion {
  action: 'buy' | 'sell' | 'hold' | 'rebalance'
  symbol: string
  reasoning: string
  priority: 'high' | 'medium' | 'low'
}

export interface SuggestionsResponse {
  suggestions: Suggestion[]
  summary: string
}

// ── Simulation AI ─────────────────────────────────────────────────

export const simulationChatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(chatHistoryEntrySchema).max(40).optional(),
})
export type SimulationChatBody = z.infer<typeof simulationChatSchema>

export interface SimulationAccountContext {
  name: string
  balance: number
  positions: {
    symbol: string
    type: string
    quantity: number
    avgCost: number
    currentPrice: number | null
    unrealizedPnL: number | null
  }[]
  recentOrders: {
    orderId: string
    symbol: string
    side: string
    quantity: number
    fillPrice: number
    totalValue: number
    createdAt: string
  }[]
}

export interface TradeProposal {
  proposalId: string
  side: 'BUY' | 'SELL'
  symbol: string
  type: 'STOCK' | 'CRYPTO'
  quantity: number
  estimatedPrice: number
  estimatedTotal: number
  projectedBalanceAfter: number
  warnings: string[]
}

export interface TradeExecutionSummary {
  side: 'BUY' | 'SELL'
  symbol: string
  type: 'STOCK' | 'CRYPTO'
  quantity: number
  fillPrice: number
  totalValue: number
  realizedPnL: number | null
  balanceAfter: number
}

export type SimulationChatResponse =
  | { kind: 'message'; reply: string }
  | { kind: 'trade_proposal'; reply: string; proposal: TradeProposal }
  | { kind: 'trade_executed'; reply: string; execution: TradeExecutionSummary }
  | { kind: 'graph_portfolio'; reply: string }
  | { kind: 'graph_asset'; reply: string; symbol: string; type: 'STOCK' | 'CRYPTO' }

export interface TradeCoachResponse {
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F'
  strengths: string[]
  weaknesses: string[]
  recentTradeAnalysis: {
    orderId: string
    symbol: string
    assessment: 'good' | 'neutral' | 'poor'
    reasoning: string
  }[]
  coachingTip: string
}

export interface RiskManagerResponse {
  riskLevel: 'low' | 'medium' | 'high' | 'extreme'
  approved: boolean
  warnings: string[]
  positionSizePercent: number
  recommendation: string
}

export interface StrategyGeneratorResponse {
  strategies: {
    name: string
    description: string
    suitability: 'beginner' | 'intermediate' | 'advanced'
    expectedRisk: 'low' | 'medium' | 'high'
    suggestedActions: string[]
  }[]
  rationale: string
}
