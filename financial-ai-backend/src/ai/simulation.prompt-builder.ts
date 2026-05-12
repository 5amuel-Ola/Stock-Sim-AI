import type { ChatMessage } from './ai.provider'
import type {
  RiskManagerResponse,
  SimulationAccountContext,
  StrategyGeneratorResponse,
  TradeCoachResponse,
} from './ai.types'

function buildConversation(
  systemPrompt: string,
  userContent: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userContent },
  ]
}

export class SimulationPromptBuilder {
  buildAccountContext(account: SimulationAccountContext): string {
    const positionLines = account.positions.length === 0
      ? 'No open positions.'
      : account.positions
          .map(position => (
            `${position.symbol} (${position.type}): ${position.quantity} units, avg cost $${position.avgCost.toFixed(2)}`
            + (position.currentPrice != null
              ? `, current $${position.currentPrice.toFixed(2)}, unrealized P&L $${(position.unrealizedPnL ?? 0).toFixed(2)}`
              : ' (price unavailable)')
          ))
          .join('\n')

    const orderLines = account.recentOrders.length === 0
      ? 'No order history.'
      : account.recentOrders
          .map(order => (
            `[${order.orderId}] ${order.side} ${order.quantity} ${order.symbol} @ $${order.fillPrice.toFixed(2)} `
            + `(total $${order.totalValue.toFixed(2)}) on ${order.createdAt}`
          ))
          .join('\n')

    return `Account: ${account.name}
Cash Balance: $${account.balance.toFixed(2)}

Open Positions:
${positionLines}

Recent Orders:
${orderLines}`
  }

  buildSimulationChatMessages(
    message: string,
    account: SimulationAccountContext,
    history: { role: 'user' | 'assistant'; content: string }[] = [],
  ): ChatMessage[] {
    const context = this.buildAccountContext(account)
    const systemPrompt = `You are a direct, knowledgeable trading analyst. The user is running a virtual trading simulation with real market prices.

ACCOUNT CONTEXT:
${context}

RESPONSE RULES — follow these strictly:
1. Give a SPECIFIC answer with a clear stance (e.g. "TSLA is risky for a 2-month hold right now because...").
2. Reference CONCRETE facts: recent earnings, product catalysts, macro events, valuation multiples, sector trends — whatever is most relevant.
3. Tie your answer to THIS user's portfolio: their current positions, cash balance ($${account.balance.toFixed(0)}), and concentration risk.
4. Keep the response under 120 words. Be dense with insight, not verbose.
5. No markdown formatting: do not use ** ** for bold, no underscores, no code fences.
6. NEVER list generic "factors to consider" — give a real opinion backed by specifics.
7. If asked about a stock they already hold, include their unrealized P&L in the analysis.
8. End with one concrete action recommendation (buy X shares, hold, wait for Y before buying, etc.).
9. You have full context of the conversation history — use it. If the user says "expand on that" or "what about that stock", refer back to what was just discussed.
10. NOTE: Direct trade commands (e.g. "buy 10 AAPL", "sell 5 shares of XYZ") are handled by trade orchestration outside this prompt. Respond normally to any other analytical questions.`
    return buildConversation(systemPrompt, message, history)
  }

  buildTradeCoachMessages(account: SimulationAccountContext): ChatMessage[] {
    const systemPrompt = `You are a trading coach reviewing a simulated account. Return a JSON object with exactly these fields:
- overallGrade: "A", "B", "C", "D", or "F" based on trading quality
- strengths: array of strings (empty array if nothing to note)
- weaknesses: array of strings (empty array if none)
- recentTradeAnalysis: array of objects, one per order, each with { orderId: string, symbol: string, assessment: "good"|"neutral"|"poor", reasoning: string }
- coachingTip: one concrete actionable improvement tip
Respond with valid JSON only.`
    return buildConversation(systemPrompt, this.buildAccountContext(account))
  }

  buildRiskManagerMessages(
    account: SimulationAccountContext,
    proposedTrade: { symbol: string; type: string; side: string; quantity: number; estimatedValue: number },
  ): ChatMessage[] {
    const systemPrompt = `You are a risk manager evaluating a proposed trade in a simulation account. Return a JSON object with exactly these fields:
- riskLevel: "low", "medium", "high", or "extreme"
- approved: boolean (your recommendation, not enforced)
- warnings: array of strings (empty array if none)
- positionSizePercent: the proposed trade value as a % of total portfolio value (cash + all position values)
- recommendation: one sentence
Respond with valid JSON only.`
    const totalPortfolioValue = account.balance
      + account.positions.reduce(
        (sum, position) => sum + (position.currentPrice != null ? position.quantity * position.currentPrice : 0),
        0,
      )
    const userContent = `Account context:\n${this.buildAccountContext(account)}\n\nTotal portfolio value (cash + positions at current prices): $${totalPortfolioValue.toFixed(2)}\n\nProposed trade: ${JSON.stringify(proposedTrade)}`
    return buildConversation(systemPrompt, userContent)
  }

  buildStrategyGeneratorMessages(account: SimulationAccountContext): ChatMessage[] {
    const systemPrompt = `You are a trading strategist reviewing a simulated account. Return a JSON object with exactly these fields:
- strategies: array of 2-3 objects each with { name: string, description: string, suitability: "beginner"|"intermediate"|"advanced", expectedRisk: "low"|"medium"|"high", suggestedActions: string[] (3-5 items) }
- rationale: one paragraph explaining why these strategies fit this account
Respond with valid JSON only.`
    return buildConversation(systemPrompt, this.buildAccountContext(account))
  }
}

export const simulationPromptBuilder = new SimulationPromptBuilder()

export type SimulationPromptResponses = TradeCoachResponse | RiskManagerResponse | StrategyGeneratorResponse