// financial-ai-backend/src/ai/ai.service.ts
import type { AiProvider } from './ai.provider'
import { createAiProviderFactory } from './ai-provider.factory'
import { portfolioPromptBuilder } from './portfolio.prompt-builder'
import { simulationPromptBuilder } from './simulation.prompt-builder'
import type {
  PortfolioContext,
  ChatResponse,
  ChatHistoryEntry,
  SummaryResponse,
  RiskAnalysisResponse,
  TrendAnalysisResponse,
  SuggestionsResponse,
  SimulationAccountContext,
  SimulationChatResponse,
  TradeCoachResponse,
  RiskManagerResponse,
  StrategyGeneratorResponse,
} from './ai.types'

export function createAiService(provider: AiProvider) {
  return {
    async chat(
      message: string,
      portfolio: PortfolioContext,
      history: ChatHistoryEntry[] = [],
    ): Promise<ChatResponse> {
      const reply = await provider.chat(portfolioPromptBuilder.buildChatMessages(message, portfolio, history))
      return { reply }
    },

    async summary(portfolio: PortfolioContext): Promise<SummaryResponse> {
      const summary = await provider.chat(portfolioPromptBuilder.buildSummaryMessages(portfolio))
      return { summary }
    },

    async riskAnalysis(portfolio: PortfolioContext): Promise<RiskAnalysisResponse> {
      return provider.structuredJson<RiskAnalysisResponse>(portfolioPromptBuilder.buildRiskAnalysisMessages(portfolio))
    },

    async trendAnalysis(portfolio: PortfolioContext): Promise<TrendAnalysisResponse> {
      return provider.structuredJson<TrendAnalysisResponse>(portfolioPromptBuilder.buildTrendAnalysisMessages(portfolio))
    },

    async investmentSuggestions(portfolio: PortfolioContext): Promise<SuggestionsResponse> {
      return provider.structuredJson<SuggestionsResponse>(portfolioPromptBuilder.buildInvestmentSuggestionsMessages(portfolio))
    },

    async simulationChat(
      message: string,
      account: SimulationAccountContext,
      history: { role: 'user' | 'assistant'; content: string }[] = []
    ): Promise<SimulationChatResponse> {
      const reply = await provider.chat(
        simulationPromptBuilder.buildSimulationChatMessages(message, account, history),
      )
      return { kind: 'message', reply }
    },

    async tradeCoach(account: SimulationAccountContext): Promise<TradeCoachResponse> {
      return provider.structuredJson<TradeCoachResponse>(simulationPromptBuilder.buildTradeCoachMessages(account))
    },

    async riskManager(
      account: SimulationAccountContext,
      proposedTrade: { symbol: string; type: string; side: string; quantity: number; estimatedValue: number }
    ): Promise<RiskManagerResponse> {
      return provider.structuredJson<RiskManagerResponse>(
        simulationPromptBuilder.buildRiskManagerMessages(account, proposedTrade),
      )
    },

    async strategyGenerator(account: SimulationAccountContext): Promise<StrategyGeneratorResponse> {
      return provider.structuredJson<StrategyGeneratorResponse>(
        simulationPromptBuilder.buildStrategyGeneratorMessages(account),
      )
    },
  }
}

const aiProviderFactory = createAiProviderFactory()

export const aiService = createAiService(aiProviderFactory.createProviderWithFallback('openai', 'gemini'))
