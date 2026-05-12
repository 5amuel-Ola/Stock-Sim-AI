// financial-ai-backend/src/market/stock-reference.ts
// Reference data for asset symbol-to-name mapping.
// Used for search functionality and AI symbol resolution fallbacks.

export interface StockReference {
  symbol: string
  companyName: string
  type: 'STOCK' | 'CRYPTO'
}

// Curated list of common assets and their full names.
// Sorted by symbol for easy maintenance
export const stockReferences: StockReference[] = [
  { symbol: 'AAPL', companyName: 'Apple Inc.', type: 'STOCK' },
  { symbol: 'ABNB', companyName: 'Airbnb Inc.', type: 'STOCK' },
  { symbol: 'ADBE', companyName: 'Adobe Inc.', type: 'STOCK' },
  { symbol: 'AMD', companyName: 'Advanced Micro Devices Inc.', type: 'STOCK' },
  { symbol: 'AMZN', companyName: 'Amazon.com Inc.', type: 'STOCK' },
  { symbol: 'ASML', companyName: 'ASML Holding N.V.', type: 'STOCK' },
  { symbol: 'AVGO', companyName: 'Broadcom Inc.', type: 'STOCK' },
  { symbol: 'AXON', companyName: 'Axon Enterprise Inc.', type: 'STOCK' },
  { symbol: 'MSFT', companyName: 'Microsoft Corporation', type: 'STOCK' },
  { symbol: 'GOOG', companyName: 'Alphabet Inc.', type: 'STOCK' },
  { symbol: 'GOOGL', companyName: 'Alphabet Inc.', type: 'STOCK' },
  { symbol: 'META', companyName: 'Meta Platforms Inc.', type: 'STOCK' },
  { symbol: 'NVDA', companyName: 'NVIDIA Corporation', type: 'STOCK' },
  { symbol: 'TSLA', companyName: 'Tesla Inc.', type: 'STOCK' },
  { symbol: 'JPM', companyName: 'JPMorgan Chase & Co.', type: 'STOCK' },
  { symbol: 'GS', companyName: 'The Goldman Sachs Group Inc.', type: 'STOCK' },
  { symbol: 'MS', companyName: 'Morgan Stanley', type: 'STOCK' },
  { symbol: 'BAC', companyName: 'Bank of America Corporation', type: 'STOCK' },
  { symbol: 'C', companyName: 'Citigroup Inc.', type: 'STOCK' },
  { symbol: 'WFC', companyName: 'Wells Fargo & Company', type: 'STOCK' },
  { symbol: 'BLK', companyName: 'BlackRock Inc.', type: 'STOCK' },
  { symbol: 'MMC', companyName: 'Marsh & McLennan Companies Inc.', type: 'STOCK' },
  { symbol: 'COF', companyName: 'Capital One Financial Corporation', type: 'STOCK' },
  { symbol: 'AXP', companyName: 'American Express Company', type: 'STOCK' },
  { symbol: 'DIS', companyName: 'The Walt Disney Company', type: 'STOCK' },
  { symbol: 'MCD', companyName: 'McDonald\'s Corporation', type: 'STOCK' },
  { symbol: 'NKE', companyName: 'Nike Inc.', type: 'STOCK' },
  { symbol: 'KO', companyName: 'The Coca-Cola Company', type: 'STOCK' },
  { symbol: 'PEP', companyName: 'PepsiCo Inc.', type: 'STOCK' },
  { symbol: 'MO', companyName: 'Altria Group Inc.', type: 'STOCK' },
  { symbol: 'PM', companyName: 'Philip Morris International Inc.', type: 'STOCK' },
  { symbol: 'BTI', companyName: 'British American Tobacco PLC', type: 'STOCK' },
  { symbol: 'F', companyName: 'Ford Motor Company', type: 'STOCK' },
  { symbol: 'GM', companyName: 'General Motors Company', type: 'STOCK' },
  { symbol: 'GOEV', companyName: 'Canoo Inc.', type: 'STOCK' },
  { symbol: 'XOM', companyName: 'Exxon Mobil Corporation', type: 'STOCK' },
  { symbol: 'CVX', companyName: 'Chevron Corporation', type: 'STOCK' },
  { symbol: 'COP', companyName: 'ConocoPhillips', type: 'STOCK' },
  { symbol: 'MPC', companyName: 'Marathon Petroleum Corporation', type: 'STOCK' },
  { symbol: 'PSX', companyName: 'Phillips 66', type: 'STOCK' },
  { symbol: 'NRGY', companyName: 'NRG Energy Inc.', type: 'STOCK' },
  { symbol: 'NEE', companyName: 'NextEra Energy Inc.', type: 'STOCK' },
  { symbol: 'DUK', companyName: 'Duke Energy Corporation', type: 'STOCK' },
  { symbol: 'SO', companyName: 'The Southern Company', type: 'STOCK' },
  { symbol: 'EXC', companyName: 'Exelon Corporation', type: 'STOCK' },
  { symbol: 'BRK.B', companyName: 'Berkshire Hathaway Inc.', type: 'STOCK' },
  { symbol: 'BRK.A', companyName: 'Berkshire Hathaway Inc.', type: 'STOCK' },
  { symbol: 'SPG', companyName: 'Simon Property Group Inc.', type: 'STOCK' },
  { symbol: 'PLD', companyName: 'Prologis Inc.', type: 'STOCK' },
  { symbol: 'AMT', companyName: 'American Tower Corporation', type: 'STOCK' },
  { symbol: 'CCI', companyName: 'Crown Castle International Corp.', type: 'STOCK' },
  { symbol: 'EQIX', companyName: 'Equinix Inc.', type: 'STOCK' },
  { symbol: 'DLR', companyName: 'Digital Realty Trust Inc.', type: 'STOCK' },
  { symbol: 'O', companyName: 'Realty Income Corporation', type: 'STOCK' },
  { symbol: 'UNH', companyName: 'UnitedHealth Group Incorporated', type: 'STOCK' },
  { symbol: 'PFE', companyName: 'Pfizer Inc.', type: 'STOCK' },
  { symbol: 'JNJ', companyName: 'Johnson & Johnson', type: 'STOCK' },
  { symbol: 'AZN', companyName: 'AstraZeneca PLC', type: 'STOCK' },
  { symbol: 'LLY', companyName: 'Eli Lilly and Company', type: 'STOCK' },
  { symbol: 'MRK', companyName: 'Merck & Co. Inc.', type: 'STOCK' },
  { symbol: 'ABBV', companyName: 'AbbVie Inc.', type: 'STOCK' },
  { symbol: 'AMGN', companyName: 'Amgen Inc.', type: 'STOCK' },
  { symbol: 'BIIB', companyName: 'Biogen Inc.', type: 'STOCK' },
  { symbol: 'GILD', companyName: 'Gilead Sciences Inc.', type: 'STOCK' },
  { symbol: 'REGN', companyName: 'Regeneron Pharmaceuticals Inc.', type: 'STOCK' },
  { symbol: 'BA', companyName: 'The Boeing Company', type: 'STOCK' },
  { symbol: 'RTX', companyName: 'RTX Corporation', type: 'STOCK' },
  { symbol: 'LMT', companyName: 'Lockheed Martin Corporation', type: 'STOCK' },
  { symbol: 'GD', companyName: 'General Dynamics Corporation', type: 'STOCK' },
  { symbol: 'NOC', companyName: 'Northrop Grumman Corporation', type: 'STOCK' },
  { symbol: 'CAT', companyName: 'Caterpillar Inc.', type: 'STOCK' },
  { symbol: 'DE', companyName: 'Deere & Company', type: 'STOCK' },
  { symbol: 'NFLX', companyName: 'Netflix Inc.', type: 'STOCK' },
  { symbol: 'ROKU', companyName: 'Roku Inc.', type: 'STOCK' },
  { symbol: 'SPOT', companyName: 'Spotify Technology S.A.', type: 'STOCK' },
  { symbol: 'SQ', companyName: 'Block Inc.', type: 'STOCK' },
  { symbol: 'PYPL', companyName: 'PayPal Holdings Inc.', type: 'STOCK' },
  { symbol: 'CRWD', companyName: 'CrowdStrike Holdings Inc.', type: 'STOCK' },
  { symbol: 'OKTA', companyName: 'Okta Inc.', type: 'STOCK' },
  { symbol: 'ZOOM', companyName: 'Zoom Video Communications Inc.', type: 'STOCK' },
  { symbol: 'DOCU', companyName: 'DocuSign Inc.', type: 'STOCK' },
  { symbol: 'NET', companyName: 'Cloudflare Inc.', type: 'STOCK' },
  { symbol: 'DDOG', companyName: 'Datadog Inc.', type: 'STOCK' },
  { symbol: 'SNOW', companyName: 'Snowflake Inc.', type: 'STOCK' },
  { symbol: 'CRM', companyName: 'Salesforce Inc.', type: 'STOCK' },
  { symbol: 'ORCL', companyName: 'Oracle Corporation', type: 'STOCK' },
  { symbol: 'SAP', companyName: 'SAP SE', type: 'STOCK' },
  { symbol: 'IBM', companyName: 'International Business Machines Corporation', type: 'STOCK' },
  { symbol: 'INTC', companyName: 'Intel Corporation', type: 'STOCK' },
  { symbol: 'QCOM', companyName: 'QUALCOMM Incorporated', type: 'STOCK' },
  { symbol: 'CSCO', companyName: 'Cisco Systems Inc.', type: 'STOCK' },
  { symbol: 'AMAT', companyName: 'Applied Materials Inc.', type: 'STOCK' },
  { symbol: 'LRCX', companyName: 'Lam Research Corporation', type: 'STOCK' },
  { symbol: 'MU', companyName: 'Micron Technology Inc.', type: 'STOCK' },
  { symbol: 'MCHP', companyName: 'Microchip Technology Incorporated', type: 'STOCK' },
  { symbol: 'KLAC', companyName: 'KLA Corporation', type: 'STOCK' },
  { symbol: 'CDNS', companyName: 'Cadence Design Systems Inc.', type: 'STOCK' },
  { symbol: 'SNPS', companyName: 'Synopsys Inc.', type: 'STOCK' },
  { symbol: 'T', companyName: 'AT&T Inc.', type: 'STOCK' },
  { symbol: 'VZ', companyName: 'Verizon Communications Inc.', type: 'STOCK' },
  { symbol: 'CMCSA', companyName: 'Comcast Corporation', type: 'STOCK' },
  { symbol: 'TMUS', companyName: 'T-Mobile US Inc.', type: 'STOCK' },
  { symbol: 'CHTR', companyName: 'Charter Communications Inc.', type: 'STOCK' },
  { symbol: 'CCI', companyName: 'Crown Castle International Corp.', type: 'STOCK' },
  { symbol: 'GE', companyName: 'General Electric Company', type: 'STOCK' },
  { symbol: 'HON', companyName: 'Honeywell International Inc.', type: 'STOCK' },
  { symbol: 'ETN', companyName: 'Eaton Corporation PLC', type: 'STOCK' },
  { symbol: 'EMR', companyName: 'Emerson Electric Co.', type: 'STOCK' },
  { symbol: 'ADSK', companyName: 'Autodesk Inc.', type: 'STOCK' },
  { symbol: 'TXN', companyName: 'Texas Instruments Incorporated', type: 'STOCK' },
  { symbol: 'KEYS', companyName: 'Keysight Technologies Inc.', type: 'STOCK' },
  { symbol: 'SWKS', companyName: 'Skyworks Solutions Inc.', type: 'STOCK' },
  { symbol: 'TTWO', companyName: 'Take-Two Interactive Software Inc.', type: 'STOCK' },
  { symbol: 'RBLX', companyName: 'Roblox Corporation', type: 'STOCK' },
  { symbol: 'EA', companyName: 'Electronic Arts Inc.', type: 'STOCK' },
  { symbol: 'ATVI', companyName: 'Activision Blizzard Inc.', type: 'STOCK' },
  { symbol: 'GME', companyName: 'GameStop Corp.', type: 'STOCK' },
  { symbol: 'AMC', companyName: 'AMC Entertainment Holdings Inc.', type: 'STOCK' },
  { symbol: 'AIG', companyName: 'American International Group Inc.', type: 'STOCK' },
  { symbol: 'GEO', companyName: 'The GEO Group Inc.', type: 'STOCK' },
  { symbol: 'PARA', companyName: 'Paramount Global', type: 'STOCK' },
  { symbol: 'WBD', companyName: 'Warner Bros. Discovery Inc.', type: 'STOCK' },
  { symbol: 'RDDT', companyName: 'Reddit Inc.', type: 'STOCK' },
  { symbol: 'PSTG', companyName: 'Pure Storage Inc.', type: 'STOCK' },
  { symbol: 'COIN', companyName: 'Coinbase Global Inc.', type: 'STOCK' },
  { symbol: 'MSTR', companyName: 'MicroStrategy Incorporated', type: 'STOCK' },
  { symbol: 'HOOD', companyName: 'Robinhood Markets Inc.', type: 'STOCK' },
  { symbol: 'U', companyName: 'Unity Software Inc.', type: 'STOCK' },
  { symbol: 'PLTR', companyName: 'Palantir Technologies Inc.', type: 'STOCK' },
  { symbol: 'ARKG', companyName: 'ARK Innovation ETF', type: 'STOCK' },
  { symbol: 'SPY', companyName: 'SPDR S&P 500 ETF', type: 'STOCK' },
  { symbol: 'QQQ', companyName: 'Invesco QQQ Trust', type: 'STOCK' },
  { symbol: 'IWM', companyName: 'iShares Russell 2000 ETF', type: 'STOCK' },
  { symbol: 'GLD', companyName: 'SPDR Gold Shares', type: 'STOCK' },
  { symbol: 'TLT', companyName: 'iShares 20+ Year Treasury Bond ETF', type: 'STOCK' },
  { symbol: 'HYG', companyName: 'iShares High Yield Corporate Bond ETF', type: 'STOCK' },
  { symbol: 'ADAUSD', companyName: 'Cardano', type: 'CRYPTO' },
  { symbol: 'BTCUSD', companyName: 'Bitcoin', type: 'CRYPTO' },
  { symbol: 'DOGEUSD', companyName: 'Dogecoin', type: 'CRYPTO' },
  { symbol: 'ETHUSD', companyName: 'Ethereum', type: 'CRYPTO' },
  { symbol: 'SOLUSD', companyName: 'Solana', type: 'CRYPTO' },
  { symbol: 'XRPUSD', companyName: 'Ripple', type: 'CRYPTO' },
]

export function searchStocks(query: string): StockReference[] {
  const q = query.toLowerCase().trim()
  if (!q) return []

  const matches: Array<{ item: StockReference; score: number }> = []

  for (const stock of stockReferences) {
    const symbolLower = stock.symbol.toLowerCase()
    const nameLower = stock.companyName.toLowerCase()

    let score = 0

    // Exact symbol match (highest priority)
    if (symbolLower === q) {
      score = 1000
    }
    // Exact company name match
    else if (nameLower === q) {
      score = 900
    }
    // Symbol starts with query
    else if (symbolLower.startsWith(q)) {
      score = 800
    }
    // Company name starts with query
    else if (nameLower.startsWith(q)) {
      score = 700
    }
    // Symbol contains query
    else if (symbolLower.includes(q)) {
      score = 600
    }
    // Company name contains query
    else if (nameLower.includes(q)) {
      score = 500
    }

    if (score > 0) {
      matches.push({ item: stock, score })
    }
  }

  // Sort by score (descending) and then by symbol
  matches.sort((a, b) => b.score - a.score || a.item.symbol.localeCompare(b.item.symbol))

  return matches.map(m => m.item)
}

export function getStockBySymbol(symbol: string): StockReference | undefined {
  return stockReferences.find(s => s.symbol.toUpperCase() === symbol.toUpperCase())
}
