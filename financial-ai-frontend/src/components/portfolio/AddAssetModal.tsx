'use client'

import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ApiError } from '../../lib/httpClient'
import { marketApi } from '../../lib/marketApi'
import { simulationApi } from '../../lib/simulationApi'
import { useSimulationContext } from '../../hooks/useSimulation'
import type { MarketSearchResult } from '../../lib/types'

interface HistoryPoint {
  date: string
  close: number
}

interface Props {
  onClose: () => void
  onAdded: () => void
}

const POPULAR_CRYPTOS = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'ADAUSD', 'DOTUSD']

function prioritizeOwned(results: MarketSearchResult[], ownedSymbols: Set<string>) {
  return results
    .map(result => ({ ...result, isOwned: ownedSymbols.has(result.symbol) }))
    .sort((left, right) => Number(right.isOwned) - Number(left.isOwned))
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

export function AddAssetModal({ onClose, onAdded }: Props) {
  const { accountId, assets } = useSimulationContext()
  const [type, setType]             = useState<'STOCK' | 'CRYPTO'>('STOCK')
  const [symbol, setSymbol]         = useState('')
  const [quantity, setQuantity]     = useState('')
  const [orderType, setOrderType]   = useState<'MARKET' | 'LIMIT'>('MARKET')
  const [limitPrice, setLimitPrice] = useState('')
  const [searchingStocks, setSearchingStocks] = useState(false)
  const [stockMatches, setStockMatches] = useState<MarketSearchResult[]>([])
  const [selectedStock, setSelectedStock] = useState<MarketSearchResult | null>(null)
  const [assetHistory, setAssetHistory] = useState<HistoryPoint[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const ownedSymbolsKey = assets
    .filter(asset => asset.type === type)
    .map(asset => asset.symbol.toUpperCase())
    .sort()
    .join('|')

  useEffect(() => {
    const query = symbol.trim()
    if (!query) {
      setSearchingStocks(false)
      setStockMatches([])
      setSelectedStock(null)
      return
    }

    let isActive = true
    const timeoutId = window.setTimeout(async () => {
      setSearchingStocks(true)
      try {
        const ownedSymbols = new Set(ownedSymbolsKey ? ownedSymbolsKey.split('|') : [])
        const results = await marketApi.searchStocks(query, type)
        if (!isActive) return

        const rankedResults = prioritizeOwned(results, ownedSymbols)
        setStockMatches(rankedResults)

        const exactMatch = rankedResults.find(result => result.symbol === query.toUpperCase())
        setSelectedStock(exactMatch ?? null)
      } catch {
        if (!isActive) return
        setStockMatches([])
      } finally {
        if (isActive) {
          setSearchingStocks(false)
        }
      }
    }, 150)

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
    }
  }, [ownedSymbolsKey, symbol, type])

  // Fetch asset history when selectedStock changes
  useEffect(() => {
    if (!selectedStock) {
      setAssetHistory([])
      return
    }

    setLoadingHistory(true)
    marketApi.getMarketHistory(selectedStock.symbol, selectedStock.type)
      .then(history => {
        // Limit to last 30 days for display
        const limit = Math.max(1, history.length - 30)
        setAssetHistory(history.slice(limit))
      })
      .catch(() => setAssetHistory([]))
      .finally(() => setLoadingHistory(false))
  }, [selectedStock])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!accountId) return setError('Account not initialized — please refresh the page')

    const exactSymbolMatch = stockMatches.some(match => match.symbol === symbol.trim().toUpperCase())
    const resolvedSymbol = selectedStock?.symbol ?? symbol.trim().toUpperCase()
    const qty = parseFloat(quantity)
    if (!resolvedSymbol)        return setError('Symbol is required')
    if (!selectedStock && !exactSymbolMatch) {
      return setError(`Select a ${type === 'STOCK' ? 'stock' : 'crypto'} from the search results`)
    }
    if (isNaN(qty) || qty <= 0) return setError('Quantity must be a positive number')
    if (orderType === 'LIMIT') {
      const lp = parseFloat(limitPrice)
      if (isNaN(lp) || lp <= 0) return setError('Limit price must be a positive number')
    }

    setSaving(true)
    try {
      await simulationApi.executeTrade(accountId, {
        symbol: resolvedSymbol,
        type,
        side: 'BUY',
        quantity: qty,
        orderType,
        ...(orderType === 'LIMIT' ? { limitPrice: parseFloat(limitPrice) } : {}),
      })
      onAdded()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add asset')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white border border-black/10 w-full max-w-md p-8">

        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-black/10">
          <h2 className="text-xl font-bold text-black">Buy Asset</h2>
          <button
            onClick={onClose}
            className="text-2xl text-black/40 hover:text-black/60 leading-none font-light"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pt-6 space-y-6">

          {/* Type toggle */}
          <div>
            <label className="text-xs font-bold text-black uppercase tracking-wide block mb-3">
              Asset Type
            </label>
            <div className="flex gap-3">
              {(['STOCK', 'CRYPTO'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setType(t); setSymbol(''); setSelectedStock(null); setStockMatches([]); setAssetHistory([]) }}
                  className={`flex-1 py-2 px-4 text-sm font-medium border transition-all ${
                    type === t
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-black border-black/20 hover:border-black'
                  }`}
                >
                  {t === 'STOCK' ? 'Stock' : 'Crypto'}
                </button>
              ))}
            </div>
          </div>

          {/* Symbol */}
          <div>
            <label className="text-xs font-bold text-black uppercase tracking-wide block mb-3">
              {type === 'STOCK' ? 'Stock' : 'Crypto'}
            </label>
            <input
              type="text"
              value={symbol}
              onChange={e => {
                setSymbol(e.target.value)
                setSelectedStock(null)
                setError(null)
              }}
              placeholder={type === 'STOCK' ? 'Search company or ticker, e.g. Apple or AAPL' : 'Search coin name or symbol, e.g. Bitcoin or BTCUSD'}
              className="swiss-input w-full"
              autoFocus
              autoComplete="off"
            />
            <div className="mt-3 rounded border border-black/10">
              {searchingStocks ? (
                <p className="px-3 py-2 text-xs text-black/45">Searching {type === 'STOCK' ? 'companies' : 'crypto assets'}…</p>
              ) : stockMatches.length > 0 ? (
                stockMatches.slice(0, 6).map(match => (
                  <button
                    key={match.symbol}
                    type="button"
                    onClick={() => {
                      setSymbol(match.symbol)
                      setSelectedStock(match)
                      setError(null)
                    }}
                    className="flex w-full items-center justify-between border-b border-black/5 px-3 py-2 text-left last:border-b-0 hover:bg-black/5"
                  >
                    <div>
                      <p className="text-sm font-semibold text-black">{match.symbol}</p>
                      <p className="text-xs text-black/45">{match.companyName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {match.isOwned && (
                        <span className="rounded border border-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black/60">
                          Owned
                        </span>
                      )}
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-black/35">
                        {match.type}
                      </span>
                    </div>
                  </button>
                ))
              ) : symbol.trim() ? (
                <p className="px-3 py-2 text-xs text-black/45">No matching {type === 'STOCK' ? 'stocks' : 'cryptos'} found.</p>
              ) : (
                <p className="px-3 py-2 text-xs text-black/45">Start typing a {type === 'STOCK' ? 'company name or ticker' : 'crypto name or symbol'} to search the asset reference.</p>
              )}
            </div>
            {type === 'CRYPTO' && (
              <div className="flex flex-wrap gap-2 mt-3">
                {POPULAR_CRYPTOS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSymbol(s)
                      setSelectedStock(stockMatches.find(match => match.symbol === s) ?? null)
                    }}
                    className={`px-3 py-1.5 text-xs font-medium border transition-all ${
                      symbol === s
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-black border-black/20 hover:bg-black/5'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mini price chart for selected asset */}
          {selectedStock && (
            <div className="rounded-lg bg-slate-50 p-4 border border-black/10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-black/60 uppercase tracking-wide">30-Day Price Performance</p>
                {loadingHistory && <p className="text-xs text-black/40">Loading...</p>}
              </div>
              {assetHistory.length > 0 ? (
                <MiniChart
                  data={assetHistory}
                  up={assetHistory[assetHistory.length - 1].close >= (assetHistory[0]?.close ?? 0)}
                />
              ) : (
                <p className="text-xs text-black/40 py-8 text-center">No price data available</p>
              )}
            </div>
          )}

          {/* Quantity */}
          <div>
            <label className="text-xs font-bold text-black uppercase tracking-wide block mb-3">
              Quantity
            </label>
            <input
              type="number"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="e.g. 10"
              min="0"
              step="any"
              className="swiss-input w-full"
            />
          </div>

          {/* Order Type */}
          <div>
            <label className="text-xs font-bold text-black uppercase tracking-wide block mb-3">
              Order Type
            </label>
            <div className="flex gap-3">
              {(['MARKET', 'LIMIT'] as const).map(ot => (
                <button
                  key={ot}
                  type="button"
                  onClick={() => setOrderType(ot)}
                  className={`flex-1 py-2 px-4 text-sm font-medium border transition-all ${
                    orderType === ot
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-black border-black/20 hover:border-black'
                  }`}
                >
                  {ot === 'MARKET' ? 'Market' : 'Limit'}
                </button>
              ))}
            </div>
          </div>

          {/* Limit Price (only for LIMIT orders) */}
          {orderType === 'LIMIT' && (
            <div>
              <label className="text-xs font-bold text-black uppercase tracking-wide block mb-3">
                Limit Price (USD)
              </label>
              <input
                type="number"
                value={limitPrice}
                onChange={e => setLimitPrice(e.target.value)}
                placeholder="Max price to pay"
                min="0"
                step="any"
                className="swiss-input w-full"
              />
              <p className="text-xs text-black/40 mt-2">
                Order will fill only if market price ≤ your limit price.
              </p>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-900 bg-red-50 border border-red-200 p-4">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 text-sm font-medium text-black bg-white border border-black/20 hover:bg-black/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 px-4 text-sm font-medium text-white bg-black hover:bg-gray-800 disabled:opacity-50 transition-all"
            >
              {saving ? 'Buying…' : 'Buy'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
