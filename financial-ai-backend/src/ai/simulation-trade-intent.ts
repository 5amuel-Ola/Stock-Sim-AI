/**
 * Trade intent parser for direct market trade commands in simulation chat.
 * Detects high-confidence BUY and SELL intents with explicit quantity.
 */

export interface ParsedTradeIntent {
  side: 'BUY' | 'SELL'
  symbol: string
  type: 'STOCK' | 'CRYPTO'
  quantity?: number
  notionalUsd?: number
  sellAll?: boolean
}

const CRYPTO_SYMBOLS = new Set([
  'ADA', 'ADAUSD', 'CARDANO',
  'BTC', 'BITCOIN',
  'BTCUSD',
  'DOGEUSD',
  'ETH', 'ETHEREUM',
  'ETHUSD',
  'XRP', 'DOGE', 'DOGECOIN',
  'XRPUSD',
  'SOL', 'SOLANA', 'SOLUSD',
])

const BUY_NOTIONAL_PATTERNS = [
  /^buy(?:\s+me)?\s+\$?(\d+(?:\.\d+)?)\s+worth\s+of\s+([a-z]+)/i,
  /^purchase(?:\s+me)?\s+\$?(\d+(?:\.\d+)?)\s+worth\s+of\s+([a-z]+)/i,
  /^acquire(?:\s+me)?\s+\$?(\d+(?:\.\d+)?)\s+worth\s+of\s+([a-z]+)/i,
]

const BUY_PATTERNS = [
  /^buy(?:\s+me)?\s+(\d+(?:\.\d+)?)\s+(?:shares?\s+of\s+)?([a-z]+)/i,
  /^buy\s+([a-z]+)\s+(\d+(?:\.\d+)?)/i,
  /^purchase(?:\s+me)?\s+(\d+(?:\.\d+)?)\s+(?:shares?\s+of\s+)?([a-z]+)/i,
  /^purchase\s+([a-z]+)\s+(\d+(?:\.\d+)?)/i,
  /^acquire(?:\s+me)?\s+(\d+(?:\.\d+)?)\s+(?:shares?\s+of\s+)?([a-z]+)/i,
]

const SELL_PATTERNS = [
  /^sell(?:\s+me)?\s+(\d+(?:\.\d+)?)\s+(?:shares?\s+of\s+)?([a-z]+)/i,
  /^sell\s+([a-z]+)\s+(\d+(?:\.\d+)?)/i,
  /^liquidate(?:\s+me)?\s+(\d+(?:\.\d+)?)\s+(?:shares?\s+of\s+)?([a-z]+)/i,
  /^liquidate\s+([a-z]+)\s+(\d+(?:\.\d+)?)/i,
]

const SELL_ALL_PATTERNS = [
  /^(?:sell|liquidate)(?:\s+me)?\s+all(?:\s+of)?\s+(?:my\s+)?(?:shares?|stock|position|crypto|coins?|units?)?\s*(?:of|for)?\s*([a-z]+)/i,
]

/**
 * Parse a message for direct trade intent.
 * Returns null if no clear trade intent is detected.
 * Only matches explicit quantity-based market orders.
 */
export function parseTradeIntent(message: string): ParsedTradeIntent | null {
  const trimmed = message.trim()

  for (const pattern of BUY_NOTIONAL_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      const intent = buildNotionalIntent('BUY', match[2], match[1])
      if (intent) return intent
    }
  }

  // Check BUY patterns
  for (const pattern of BUY_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      // pattern groups vary: (quantity, symbol) or (symbol, quantity)
      let quantity: string
      let symbol: string

      if (!isNaN(Number(match[1]))) {
        // First group is quantity
        quantity = match[1]
        symbol = match[2]
      } else {
        // First group is symbol
        symbol = match[1]
        quantity = match[2]
      }

      const intent = buildIntent('BUY', symbol, quantity)
      if (intent) return intent
    }
  }

  // Check SELL-all patterns
  for (const pattern of SELL_ALL_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      const intent = buildSellAllIntent(match[1])
      if (intent) return intent
    }
  }

  // Check SELL patterns
  for (const pattern of SELL_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      let quantity: string
      let symbol: string

      if (!isNaN(Number(match[1]))) {
        quantity = match[1]
        symbol = match[2]
      } else {
        symbol = match[1]
        quantity = match[2]
      }

      const intent = buildIntent('SELL', symbol, quantity)
      if (intent) return intent
    }
  }

  return null
}

function buildSellAllIntent(symbolRaw: string): ParsedTradeIntent | null {
  const normalizedSymbol = symbolRaw.toUpperCase()

  return {
    side: 'SELL',
    symbol: normalizedSymbol,
    type: inferAssetType(normalizedSymbol),
    sellAll: true,
  }
}

function buildIntent(side: 'BUY' | 'SELL', symbolRaw: string, quantityRaw: string): ParsedTradeIntent | null {
  // Validate quantity
  const qty = parseFloat(quantityRaw)
  if (isNaN(qty) || qty <= 0 || !Number.isFinite(qty)) {
    return null
  }

  const normalizedSymbol = symbolRaw.toUpperCase()
  const type: 'STOCK' | 'CRYPTO' = inferAssetType(normalizedSymbol)

  const quantity = type === 'CRYPTO'
    ? Number(qty.toFixed(8))
    : Math.floor(qty)

  if (quantity === 0) {
    return null
  }

  return {
    side,
    symbol: normalizedSymbol,
    type,
    quantity,
  }
}

function buildNotionalIntent(side: 'BUY' | 'SELL', symbolRaw: string, amountRaw: string): ParsedTradeIntent | null {
  const notionalUsd = parseFloat(amountRaw)
  if (isNaN(notionalUsd) || notionalUsd <= 0 || !Number.isFinite(notionalUsd)) {
    return null
  }

  const normalizedSymbol = symbolRaw.toUpperCase()
  const type = inferAssetType(normalizedSymbol)

  return {
    side,
    symbol: normalizedSymbol,
    type,
    notionalUsd,
  }
}

function inferAssetType(symbol: string): 'STOCK' | 'CRYPTO' {
  return CRYPTO_SYMBOLS.has(symbol) || symbol.endsWith('USD') ? 'CRYPTO' : 'STOCK'
}
