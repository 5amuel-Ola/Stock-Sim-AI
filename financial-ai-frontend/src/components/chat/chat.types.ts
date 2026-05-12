export interface ChatTradeProposal {
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

export interface ChatTradeExecution {
  side: 'BUY' | 'SELL'
  symbol: string
  type: 'STOCK' | 'CRYPTO'
  quantity: number
  fillPrice: number
  totalValue: number
  realizedPnL: number | null
  balanceAfter: number
}

export interface ChatGraphRequest {
  kind: 'portfolio_graph' | 'asset_graph'
  symbol?: string
  type?: 'STOCK' | 'CRYPTO'
}

export interface ChatDisplayMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  proposal?: ChatTradeProposal
  execution?: ChatTradeExecution
  graph?: ChatGraphRequest
}

export interface ChatHistoryEntry {
  role: 'user' | 'assistant'
  content: string
}

const MAX_CHAT_HISTORY_ENTRIES = 40

export function toChatHistory(messages: ChatDisplayMessage[]): ChatHistoryEntry[] {
  return messages
    .slice(1)
    .map<ChatHistoryEntry>(message => ({
      role: message.role === 'user' ? 'user' : 'assistant',
      content: message.text,
    }))
    .slice(-MAX_CHAT_HISTORY_ENTRIES)
}