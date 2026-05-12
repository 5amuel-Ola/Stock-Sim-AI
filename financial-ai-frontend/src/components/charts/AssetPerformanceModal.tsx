'use client'

import React, { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { marketApi } from '../../lib/marketApi'
import type { TimeframeFilter } from '../../lib/types'

interface HistoryPoint {
  date: string
  close: number
}

interface AssetPerformanceModalProps {
  isOpen: boolean
  symbol: string
  type: 'STOCK' | 'CRYPTO'
  onClose: () => void
  currentPrice?: number | null
  previousClose?: number | null
  changePercent?: number | null
  quantity?: number
  averageCost?: number
}

export function AssetPerformanceModal({
  isOpen,
  symbol,
  type,
  onClose,
  currentPrice,
  previousClose,
  changePercent,
  quantity,
  averageCost,
}: AssetPerformanceModalProps) {
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('1M')
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const fetchHistory = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await marketApi.getMarketHistory(symbol, type)
        
        // Filter based on timeframe
        let filtered = data
        if (timeframe !== 'all') {
          const now = new Date()
          let cutoffDate = new Date()
          
          if (timeframe === '1W') cutoffDate.setDate(cutoffDate.getDate() - 7)
          if (timeframe === '1M') cutoffDate.setMonth(cutoffDate.getMonth() - 1)
          if (timeframe === '3M') cutoffDate.setMonth(cutoffDate.getMonth() - 3)
          
          filtered = data.filter(point => {
            const pointDate = new Date(point.date)
            return pointDate >= cutoffDate
          })
        }

        setHistory(filtered)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load price history')
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [isOpen, symbol, type, timeframe])

  if (!isOpen) return null

  const currentValue = currentPrice != null && quantity != null ? currentPrice * quantity : null
  const unrealizedPnL = currentPrice != null && quantity != null && averageCost != null
    ? (currentPrice - averageCost) * quantity
    : null

  const percentChange = previousClose && currentPrice
    ? ((currentPrice - previousClose) / previousClose) * 100
    : changePercent

  const isUp = percentChange && percentChange >= 0
  const minPrice = history.length > 0 ? Math.min(...history.map(h => h.close)) : currentPrice ?? 0
  const maxPrice = history.length > 0 ? Math.max(...history.map(h => h.close)) : currentPrice ?? 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-black/10 bg-white p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-black">{symbol}</h2>
              <p className="text-sm text-black/60 mt-1">Asset Performance Chart</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-black/5 transition-colors"
              aria-label="Close modal"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Price metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-black/60 font-semibold uppercase tracking-wide">Current Price</p>
              <p className="text-lg font-bold text-black mt-1">
                {currentPrice != null ? `$${currentPrice.toFixed(2)}` : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-black/60 font-semibold uppercase tracking-wide">Previous Close</p>
              <p className="text-lg font-bold text-black mt-1">
                {previousClose != null ? `$${previousClose.toFixed(2)}` : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-black/60 font-semibold uppercase tracking-wide">Change</p>
              <p className={`text-lg font-bold mt-1 ${isUp ? 'text-green-700' : 'text-red-700'}`}>
                {percentChange != null ? `${isUp ? '+' : ''}${percentChange.toFixed(2)}%` : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-black/60 font-semibold uppercase tracking-wide">Price Range</p>
              <p className="text-xs font-semibold text-black mt-1">
                ${minPrice.toFixed(2)} — ${maxPrice.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Portfolio metrics (if asset is owned) */}
          {quantity != null && averageCost != null && (
            <div className="rounded-lg bg-blue-50 p-4 border border-blue-100">
              <p className="text-xs text-blue-900 font-semibold uppercase tracking-wide">Your Position</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                <div>
                  <p className="text-xs text-blue-700">Quantity</p>
                  <p className="text-sm font-bold text-blue-900">{quantity} units</p>
                </div>
                <div>
                  <p className="text-xs text-blue-700">Avg Cost</p>
                  <p className="text-sm font-bold text-blue-900">${averageCost.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-700">Current Value</p>
                  <p className="text-sm font-bold text-blue-900">
                    {currentValue != null ? `$${currentValue.toFixed(2)}` : '—'}
                  </p>
                </div>
                {unrealizedPnL != null && (
                  <div>
                    <p className="text-xs text-blue-700">Unrealized P&L</p>
                    <p className={`text-sm font-bold ${unrealizedPnL >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnL.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeframe selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-black/60 uppercase tracking-wide">Timeframe:</span>
            <div className="flex gap-2">
              {(['1W', '1M', '3M', 'all'] as const).map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    timeframe === tf
                      ? 'bg-black text-white'
                      : 'bg-black/5 text-black hover:bg-black/10'
                  }`}
                >
                  {tf === 'all' ? 'All' : tf}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm text-black/60">Loading price history...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : history.length < 2 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm text-black/60">Insufficient data for {symbol}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={history} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
                <Tooltip
                  formatter={(v: number) => [`$${v.toFixed(2)}`, 'Close']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke={isUp ? '#16a34a' : '#dc2626'}
                  strokeWidth={2}
                  dot={{ fill: isUp ? '#16a34a' : '#dc2626', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
