'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import type { Asset, Transaction, TimeframeFilter } from '../../lib/types'

// ── helpers ──────────────────────────────────────────────

function cutoffDate(tf: TimeframeFilter): Date | null {
  if (tf === 'all') return null
  const d = new Date()
  if (tf === '1W') d.setDate(d.getDate() - 7)
  if (tf === '1M') d.setMonth(d.getMonth() - 1)
  if (tf === '3M') d.setMonth(d.getMonth() - 3)
  return d
}

/**
 * Builds a step-series from transaction history.
 * Each transaction adds a data point showing what the portfolio would be
 * worth at that moment using current prices (simplified but useful view).
 */
function buildTimeSeries(
  transactions: Transaction[],
  priceMap: Record<string, number>,
  tf: TimeframeFilter,
): { date: string; value: number }[] {
  const since = cutoffDate(tf)
  const sorted = [...transactions]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .filter(tx => !since || new Date(tx.timestamp) >= since)

  if (sorted.length === 0) return []

  const positions: Record<string, number> = {}
  return sorted.map(tx => {
    const { symbol } = tx.asset
    positions[symbol] = (positions[symbol] ?? 0) + (tx.type === 'BUY' ? tx.quantity : -tx.quantity)

    const value = Object.entries(positions).reduce((sum, [sym, qty]) => {
      // Fall back to the transaction price if we don't have a live price
      return sum + (qty > 0 ? (priceMap[sym] ?? tx.price) * qty : 0)
    }, 0)

    return {
      date: new Date(tx.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: parseFloat(value.toFixed(2)),
    }
  })
}

const fmt = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`)

// ── component ─────────────────────────────────────────────

interface Props {
  assets: Asset[]
  transactions: Transaction[]
  timeframe: TimeframeFilter
}

export function PortfolioValueChart({ assets, transactions, timeframe }: Props) {
  const priceMap = Object.fromEntries(
    assets.filter(a => a.currentPrice != null).map(a => [a.symbol, a.currentPrice!])
  )

  const data = buildTimeSeries(transactions, priceMap, timeframe)

  // No transactions yet — show a static current-value placeholder
  if (data.length === 0) {
    const currentValue = assets.reduce(
      (sum, a) => sum + (a.currentPrice != null ? a.quantity * a.currentPrice : 0),
      0
    )
    return (
      <div className="flex flex-col items-center justify-center h-52 gap-1.5">
        <p className="text-3xl font-bold text-slate-900">
          {currentValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
        </p>
        <p className="text-sm text-slate-500">Current portfolio value</p>
        <p className="text-xs text-slate-400">Record transactions to see performance over time</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
        <YAxis
          tickFormatter={fmt}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip
          formatter={(v: number) => [v.toLocaleString('en-US', { style: 'currency', currency: 'USD' }), 'Value']}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ fill: '#3b82f6', r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
