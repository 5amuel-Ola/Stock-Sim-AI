// Shared TypeScript types mirroring the backend API responses.

// ── Portfolio ─────────────────────────────────────────────

export interface Asset {
  id: string
  userId: string
  symbol: string
  companyName?: string | null
  type: 'STOCK' | 'CRYPTO'
  quantity: number
  averageCost: number
  currentPrice: number | null
  priceTimestamp: string | null
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  userId: string
  assetId: string
  type: 'BUY' | 'SELL'
  orderType: 'MARKET' | 'LIMIT'
  quantity: number
  price: number | null
  limitPrice: number | null
  timestamp: string
  realizedPnL: number | null
  status: 'OPEN' | 'FILLED' | 'CANCELED'
  // Joined relation — included by the backend's getTransactions query
  asset: { symbol: string; type: string }
  // Company name from security reference (for display in positions and history)
  companyName?: string | null
  // Cost basis per unit for sell transactions (historical buy price for display)
  costBasisPerUnit?: number | null
}

// ── Market Search ────────────────────────────────────────

export interface MarketSearchResult {
  symbol: string
  companyName: string
  type: 'STOCK' | 'CRYPTO'
  isOwned?: boolean  // Frontend will set this if user already holds
}

// ── AI agents ────────────────────────────────────────────

export interface RiskAnalysis {
  riskLevel: 'low' | 'medium' | 'high'
  diversificationScore: number   // 1–10
  concentrationWarnings: string[]
  sectorExposure: Record<string, number>  // sector → % of portfolio
  totalPortfolioValue: number
  recommendation: string
}

export interface AssetTrend {
  symbol: string
  trend: 'bullish' | 'bearish' | 'neutral'
  reasoning: string
}

export interface TrendAnalysis {
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

export interface InvestmentSuggestions {
  suggestions: Suggestion[]
  summary: string
}

// ── Filters ───────────────────────────────────────────────

export type AssetTypeFilter = 'all' | 'STOCK' | 'CRYPTO'
export type TimeframeFilter = '1W' | '1M' | '3M' | 'all'
export type RiskLevelFilter = 'all' | 'low' | 'medium' | 'high'

export interface Filters {
  assetType: AssetTypeFilter
  timeframe: TimeframeFilter
  riskLevel: RiskLevelFilter
}
