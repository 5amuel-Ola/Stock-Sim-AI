'use client'

import { useCallback, useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ApiError } from '../../lib/httpClient'
import { marketApi } from '../../lib/marketApi'
import type { Asset, MarketSearchResult } from '../../lib/types'

interface PriceResult {
  symbol: string
  price: number
  previousClose?: number
  changePercent?: number
  type: 'STOCK' | 'CRYPTO'
}

interface HistoryPoint {
  date: string
  close: number
}

interface Props {
  portfolioAssets: Asset[]
}

const POPULAR_STOCKS  = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA', 'AMZN', 'META', 'SPY']
const POPULAR_CRYPTOS = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'ADAUSD']

function prioritizeOwned(results: MarketSearchResult[], ownedSymbols: Set<string>) {
  return results
    .map(result => ({ ...result, isOwned: ownedSymbols.has(result.symbol) }))
    .sort((left, right) => Number(right.isOwned) - Number(left.isOwned))
}

function ChangeChip({ pct }: { pct: number | undefined }) {
  if (pct == null) return null
  const up  = pct >= 0
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 ${
      up ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
    }`}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
    </span>
  )
}

function MiniChart({ data, up }: { data: HistoryPoint[]; up: boolean }) {
  if (data.length < 2) return null
  const color = up ? '#16a34a' : '#dc2626'
  const min = Math.min(...data.map(d => d.close))
  const max = Math.max(...data.map(d => d.close))
  const pad = (max - min) * 0.05

  return (
    <ResponsiveContainer width="100%" height={90}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${up}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.15} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" hide />
        <YAxis domain={[min - pad, max + pad]} hide />
        <Tooltip
          contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 0, fontSize: 11, padding: '4px 8px' }}
          formatter={(v: number) => [`$${v.toFixed(2)}`, 'Close']}
          labelFormatter={(l: string) => l}
        />
        <Area
          type="monotone"
          dataKey="close"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#grad-${up})`}
          dot={false}
          activeDot={{ r: 3, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function StockSearchPanel({ portfolioAssets }: Props) {
  const [query, setQuery]       = useState('')
  const [assetType, setAssetType] = useState<'STOCK' | 'CRYPTO'>('STOCK')
  const [result, setResult]     = useState<PriceResult | null>(null)
  const [history, setHistory]   = useState<HistoryPoint[]>([])
  const [selectedCompanyName, setSelectedCompanyName] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<MarketSearchResult[]>([])
  const [searchingCandidates, setSearchingCandidates] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const ownedAssetSymbolsKey = portfolioAssets
    .filter(asset => asset.type === assetType)
    .map(asset => asset.symbol.toUpperCase())
    .sort()
    .join('|')

  const lookup = useCallback(async (symbol: string, type: 'STOCK' | 'CRYPTO') => {
    if (!symbol.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setHistory([])
    try {
      const [price, hist] = await Promise.all([
        type === 'STOCK' ? marketApi.getStockPrice(symbol) : marketApi.getCryptoPrice(symbol),
        marketApi.getMarketHistory(symbol, type),
      ])
      setResult({ ...price, type } as PriceResult)
      setHistory(hist)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not find "${symbol}"`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      setCandidates([])
      setSearchingCandidates(false)
      setSelectedCompanyName(null)
      return
    }

    let isActive = true
    const timeoutId = window.setTimeout(async () => {
      setSearchingCandidates(true)
      try {
        const ownedSymbols = new Set(ownedAssetSymbolsKey ? ownedAssetSymbolsKey.split('|') : [])
        const results = await marketApi.searchStocks(trimmedQuery, assetType)
        if (!isActive) return

        const rankedResults = prioritizeOwned(results, ownedSymbols)
        setCandidates(rankedResults)

        const exactMatch = rankedResults.find(candidate => candidate.symbol === trimmedQuery.toUpperCase())
        setSelectedCompanyName(exactMatch?.companyName ?? null)
      } catch {
        if (!isActive) return
        setCandidates([])
      } finally {
        if (isActive) {
          setSearchingCandidates(false)
        }
      }
    }, 150)

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
    }
  }, [assetType, ownedAssetSymbolsKey, query])

  const handleCandidateSelect = useCallback((candidate: MarketSearchResult) => {
    setSelectedCompanyName(candidate.companyName)
    setQuery(candidate.symbol)
    setCandidates([])
    void lookup(candidate.symbol, candidate.type)
  }, [lookup])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const trimmedQuery = query.trim()
    if (!trimmedQuery) return

    if (assetType === 'STOCK') {
      const exactMatch = candidates.find(candidate => candidate.symbol === trimmedQuery.toUpperCase())
      if (exactMatch) {
        handleCandidateSelect(exactMatch)
        return
      }

      if (candidates[0]) {
        handleCandidateSelect(candidates[0])
        return
      }

      setSelectedCompanyName(null)
    }

    void lookup(trimmedQuery.toUpperCase(), assetType)
  }

  const suggestions = assetType === 'STOCK' ? [] : POPULAR_CRYPTOS
  const up = (result?.changePercent ?? 0) >= 0

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Collapsed header - always visible */}
      <div className="px-3 py-2 border-b border-black/10 shrink-0 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between hover:bg-black/5 px-2 py-0.5 rounded transition-all"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-black/40 uppercase tracking-wide shrink-0">Search</span>
            {result && (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-black truncate">{result.symbol}</span>
                <span className={`text-xs font-semibold ${(result.changePercent ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {(result.changePercent ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(result.changePercent ?? 0).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <span className={`text-base text-black/40 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>
      </div>

      {/* Expandable content */}
      {isExpanded && (
        <div className="flex flex-col flex-1 overflow-y-auto min-h-0">

          {/* Search bar */}
          <div className="px-4 py-3 border-b border-black/10 shrink-0 space-y-2.5">
            {/* Type toggle */}
            <div className="flex gap-2">
              {(['STOCK', 'CRYPTO'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setAssetType(t)
                    setQuery('')
                    setResult(null)
                    setHistory([])
                    setCandidates([])
                    setSelectedCompanyName(null)
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold border transition-all ${
                    assetType === t ? 'bg-black text-white border-black' : 'bg-white text-black border-black/20 hover:border-black'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Search form */}
            <form onSubmit={handleSubmit} className="flex border border-black/20 focus-within:border-black transition-all">
              <input
                type="text"
                value={query}
                onChange={e => {
                  setQuery(e.target.value)
                  setError(null)
                }}
                placeholder={assetType === 'STOCK' ? 'Search company or ticker' : 'e.g. BTCUSD'}
                className="flex-1 px-3 py-2 text-xs bg-white outline-none placeholder:text-black/30"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-3 py-2 text-xs font-semibold bg-black text-white disabled:opacity-40 hover:bg-gray-800 transition-all"
              >
                {loading ? '…' : 'Go'}
              </button>
            </form>

            {
              <div className="border border-black/10 max-h-40 overflow-y-auto">
                {searchingCandidates ? (
                  <p className="px-3 py-2 text-xs text-black/45">Searching…</p>
                ) : candidates.length > 0 ? (
                  candidates.slice(0, 6).map(candidate => (
                    <button
                      key={candidate.symbol}
                      type="button"
                      onClick={() => handleCandidateSelect(candidate)}
                      className="flex w-full items-center justify-between border-b border-black/5 px-2 py-1.5 text-left last:border-b-0 hover:bg-black/5 text-xs"
                    >
                      <div>
                        <p className="text-xs font-semibold text-black">{candidate.symbol}</p>
                        <p className="text-[11px] text-black/45 line-clamp-1">{candidate.companyName}</p>
                      </div>
                      {candidate.isOwned && (
                        <span className="text-[9px] font-semibold text-black/60 uppercase tracking-wide shrink-0 ml-2">Owned</span>
                      )}
                    </button>
                  ))
                ) : query.trim() ? (
                  <p className="px-3 py-2 text-xs text-black/45">No matching assets</p>
                ) : (
                  <p className="px-3 py-2 text-xs text-black/45">Search to browse</p>
                )}
              </div>
            }

            {/* Quick picks */}
            <div className="flex flex-wrap gap-1">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => { setQuery(s); void lookup(s, assetType) }}
                  className="px-2 py-1 text-[11px] border border-black/15 text-black/60 hover:border-black hover:text-black transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Result card - compact */}
          {error && (
            <div className="mx-3 mt-2 px-3 py-2 text-xs text-red-800 bg-red-50 border border-red-200 shrink-0">
              {error}
            </div>
          )}

          {result && (
            <div className="mx-3 mt-2 border border-black/10 shrink-0">
              {/* Price header - compact */}
              <div className="px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold text-black/40 uppercase tracking-wide">{result.type}</p>
                    <p className="text-lg font-bold text-black">{result.symbol}</p>
                    {selectedCompanyName && (
                      <p className="text-[11px] text-black/45 line-clamp-1">{selectedCompanyName}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-black">
                      ${result.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    {result.previousClose != null && (
                      <p className="text-[10px] text-black/40">
                        prev ${result.previousClose.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-1">
                  <ChangeChip pct={result.changePercent} />
                </div>
              </div>

              {/* Sparkline - compact */}
              <div className="px-2 py-2">
                {history.length >= 2
                  ? <MiniChart data={history} up={up} />
                  : <p className="text-[10px] text-black/30 text-center py-2">No chart data</p>
                }
              </div>
            </div>
          )}

          {/* Portfolio watchlist - compact */}
          {portfolioAssets.length > 0 && (
            <div className="px-3 mt-3 pb-3">
              <p className="text-[10px] font-bold text-black/40 uppercase tracking-wide mb-2">Your Positions ({portfolioAssets.length})</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {portfolioAssets.map(a => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setQuery(a.symbol)
                      setAssetType(a.type as 'STOCK' | 'CRYPTO')
                      setSelectedCompanyName(a.companyName ?? null)
                      void lookup(a.symbol, a.type as 'STOCK' | 'CRYPTO')
                    }}
                    className="w-full flex items-center justify-between px-2 py-1.5 border border-black/10 hover:border-black transition-all text-left rounded"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[9px] font-bold text-black/40 uppercase tracking-wider shrink-0">{a.type}</span>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-black">{a.symbol}</span>
                        {a.companyName && (
                          <p className="text-[10px] text-black/45 line-clamp-1">{a.companyName}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      {a.currentPrice != null ? (
                        <span className="text-xs font-semibold text-black">
                          ${a.currentPrice.toFixed(0)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-black/30">—</span>
                      )}
                      <p className="text-[10px] text-black/40">{a.quantity} un</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!result && !error && portfolioAssets.length === 0 && !loading && (
            <p className="text-xs text-black/30 text-center mt-4 px-3">
              Search any company or ticker above.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
