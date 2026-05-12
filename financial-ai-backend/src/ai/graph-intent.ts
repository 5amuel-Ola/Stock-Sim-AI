/**
 * Graph intent parser for visualization commands in simulation chat.
 * Detects requests to show portfolio or asset graphs.
 */

export interface ParsedGraphIntent {
  kind: 'portfolio_graph' | 'asset_graph'
  symbol?: string
}

const IGNORE_ASSET_WORDS = new Set([
  'A', 'AN', 'AND', 'ANY', 'ASK', 'BUY', 'CAN', 'CREATE', 'DISPLAY', 'FOR', 'GET', 'GRAPH', 'GRAPHS',
  'CHART', 'CHARTS', 'HOLDING', 'HOLDINGS', 'I', 'IN', 'IS', 'ME', 'MY', 'OF', 'OVER', 'PLOT',
  'PORTFOLIO', 'PORTFOLIOS', 'POSITION', 'POSITIONS', 'PLEASE', 'SHOW', 'THE', 'TIME', 'VALUE',
  'VIEW', 'VISUAL', 'VISUALIZE', 'WITH', 'YOUR', 'PERFORMANCE', 'PRICE', 'HISTORY', 'SHOULD',
  'DO', 'DID', 'DOES', 'GIVE', 'MAKE', 'HAVE', 'HAS', 'HAD', 'TO', 'AT', 'ON', 'BY', 'FROM',
])

const PORTFOLIO_KEYWORDS = /(portfolio|portfolios|holdings|positions|account|balance)/i

// Portfolio graph patterns - catch various ways to ask for portfolio visualization
const PORTFOLIO_GRAPH_PATTERNS = [
  /^(?:can\s+i\s+)?(?:get|see|show|have|view)\s+(?:a\s+)?(?:graph|chart|plot|visualization)/i,
  /^(?:show|display|give|create)(?:\s+me)?\s+(?:a\s+)?(?:graph|chart|plot|visualization)\s+(?:of\s+)?(?:my\s+)?(?:portfolio|portfolios|holdings|positions|account)/i,
  /^(?:show|display|give|create)(?:\s+me)?\s+(?:my\s+)?(?:portfolio|portfolios|holdings|positions|account)\s+(?:graph|chart|plot|visualization)/i,
  /^(?:graph|chart|plot)(?:\s+me)?\s+(?:my\s+)?(?:portfolio|portfolios|holdings|positions|account|value)/i,
  /^(?:how\s+(?:has|is)|what\s+(?:is|was))\s+(?:my\s+)?(?:portfolio|account)\s+(?:doing|performing|doing|value)/i,
  /portfolio(?:s)?\s+(?:value|performance|history|trend)\s+(?:over\s+)?(?:time|graph|chart)/i,
  /(?:value|performance)\s+over\s+time/i,
]

// Asset graph patterns - catch ways to ask for a specific asset's performance
const ASSET_GRAPH_PATTERNS = [
  /^(?:can\s+i\s+)?(?:get|see|show|have|view)\s+(?:a\s+)?(?:graph|chart|plot)\s+(?:of|for)\s+([a-z]+)/i,
  /^(?:graph|chart|plot)(?:\s+me)?\s+([a-z]+)/i,
  /^(?:graph|chart|plot)(?:\s+me)?\s+(?:the\s+)?(?:performance|price|history)\s+(?:of\s+)?([a-z]+)/i,
  /^(?:show|display)\s+(?:me\s+)?(?:the\s+)?(?:graph|chart)\s+for\s+([a-z]+)/i,
  /^(?:what\s+(?:is|was)|how\s+(?:has|is))\s+([a-z]+)\s+(?:doing|performing|trading|moving)/i,
  /^([a-z]+)\s+(?:graph|chart|performance|price\s+(?:history|chart|movement))/i,
]

function tokenize(message: string) {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function pickAssetSymbol(tokens: string[]) {
  for (const token of tokens) {
    const symbol = token.toUpperCase()
    if (symbol.length >= 1 && symbol.length <= 8 && !IGNORE_ASSET_WORDS.has(symbol)) {
      return symbol
    }
  }
  return null
}

/**
 * Parse a message for graph/chart visualization intent.
 * Returns null if no clear graph intent is detected.
 */
export function parseGraphIntent(message: string): ParsedGraphIntent | null {
  const trimmed = message.trim()
  const tokens = tokenize(trimmed)

  if (PORTFOLIO_KEYWORDS.test(trimmed)) {
    for (const pattern of PORTFOLIO_GRAPH_PATTERNS) {
      if (pattern.test(trimmed)) {
        return { kind: 'portfolio_graph' }
      }
    }
  }

  // Check asset graph patterns
  for (const pattern of ASSET_GRAPH_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      // If pattern has capture group (symbol), use it; otherwise extract from tokens
      const symbol = match[1] || pickAssetSymbol(tokens)
      if (symbol) {
        return { kind: 'asset_graph', symbol: symbol.toUpperCase() }
      }
    }
  }

  // Check portfolio graph patterns after asset-specific requests.
  for (const pattern of PORTFOLIO_GRAPH_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { kind: 'portfolio_graph' }
    }
  }

  return null
}
