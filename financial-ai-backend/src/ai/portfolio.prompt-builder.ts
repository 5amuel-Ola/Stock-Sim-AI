import type { ChatMessage } from './ai.provider'
import type {
  ChatHistoryEntry,
  PortfolioContext,
  RiskAnalysisResponse,
  SuggestionsResponse,
  SummaryResponse,
  TrendAnalysisResponse,
} from './ai.types'

function buildConversation(
  systemPrompt: string,
  userContent: string,
  history: ChatHistoryEntry[] = [],
): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userContent },
  ]
}

export class PortfolioPromptBuilder {
  buildContext(portfolio: PortfolioContext): string {
    if (portfolio.assets.length === 0) {
      return 'You do not have access to the user\'s holdings or account balance yet. Treat the conversation as general market guidance unless the user supplies their own positions.'
    }

    const lines = portfolio.assets.map(asset => (
      `${asset.symbol} (${asset.type}): ${typeof asset.quantity === 'number' ? `${asset.quantity} units` : asset.quantity}`
      + (asset.currentPrice != null ? ` @ $${Number(asset.currentPrice).toFixed(2)} current price` : '')
      + (asset.changePercent != null
        ? ` (${asset.changePercent >= 0 ? '+' : ''}${Number(asset.changePercent).toFixed(2)}% vs prev close`
          + (asset.previousClose != null ? `, prev close $${Number(asset.previousClose).toFixed(2)}` : '')
          + ')'
        : asset.previousClose != null
          ? ` (prev close $${Number(asset.previousClose).toFixed(2)})`
          : '')
    ))

    return `User's portfolio:\n${lines.join('\n')}`
  }

  buildChatMessages(
    message: string,
    portfolio: PortfolioContext,
    history: ChatHistoryEntry[] = [],
  ): ChatMessage[] {
    const context = this.buildContext(portfolio)
    const systemPrompt = `You are a direct financial assistant helping a user manage their investment portfolio. ${context} RESPONSE RULES:
1. Keep answers concise: simple questions get 2-4 short sentences, list questions get up to 4 bullets.
2. Give a specific stance first (buy, hold, avoid, watchlist) with one concrete reason.
3. No markdown formatting: do not use ** ** for bold, no underscores, no code fences.
4. Cite live market data if available in the context instead of saying you lack current prices.
5. Be direct about uncertainty instead of generic disclaimers.
6. Tie your answer to the user's portfolio if relevant.`
    return buildConversation(systemPrompt, message, history)
  }

  buildSummaryMessages(portfolio: PortfolioContext): ChatMessage[] {
    const context = this.buildContext(portfolio)
    const systemPrompt = 'You are a financial assistant. Given a portfolio, provide a concise 2-3 sentence summary of its composition, notable concentrations, and overall market exposure. Be factual and brief. Do not make recommendations or predictions.'
    return buildConversation(systemPrompt, context)
  }

  buildRiskAnalysisMessages(portfolio: PortfolioContext): ChatMessage[] {
    const systemPrompt = `You are a financial risk analyst. Analyze the given portfolio and return a JSON object with exactly these fields:
- riskLevel: "low", "medium", or "high"
- diversificationScore: integer 1-10 (10 = most diversified)
- concentrationWarnings: array of strings describing any asset concentration risks (flag any single asset above 20% of portfolio value)
- sectorExposure: object mapping sector names to percentage of portfolio (values must sum to 100)
- totalPortfolioValue: total USD value of portfolio (sum of quantity * currentPrice for assets with a price, otherwise 0)
- recommendation: one concise sentence on risk management action
Respond with valid JSON only.`

    return buildConversation(systemPrompt, this.buildContext(portfolio))
  }

  buildTrendAnalysisMessages(portfolio: PortfolioContext): ChatMessage[] {
    const systemPrompt = `You are a market analyst. Analyze the given portfolio assets and return a JSON object with exactly these fields:
- overallSentiment: "bullish", "bearish", or "neutral"
- assetTrends: array of objects each with { symbol: string, trend: "bullish"|"bearish"|"neutral", reasoning: string (1-2 sentences) }
- topInsights: array of exactly 5 strings, each a concise market insight relevant to the assets
- marketOutlook: one paragraph summarizing the current market outlook for these assets
Base your analysis on your knowledge of current market conditions and the assets listed.
Respond with valid JSON only.`

    return buildConversation(systemPrompt, this.buildContext(portfolio))
  }

  buildInvestmentSuggestionsMessages(portfolio: PortfolioContext): ChatMessage[] {
    const systemPrompt = `You are an investment advisor. Based on the given portfolio, return a JSON object with exactly these fields:
- suggestions: array of 3-5 objects each with { action: "buy"|"sell"|"hold"|"rebalance", symbol: string, reasoning: string (1-2 sentences), priority: "high"|"medium"|"low" }
- summary: one paragraph summarizing the overall recommended strategy
Provide actionable advice on rebalancing, diversification, or position sizing. Do not provide specific price targets.
Respond with valid JSON only.`

    return buildConversation(systemPrompt, this.buildContext(portfolio))
  }
}

export const portfolioPromptBuilder = new PortfolioPromptBuilder()

export type PortfolioPromptResponses =
  | SummaryResponse
  | RiskAnalysisResponse
  | TrendAnalysisResponse
  | SuggestionsResponse