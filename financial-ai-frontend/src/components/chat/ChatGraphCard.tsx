'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useSimulationContext, useSimulationOrders } from '../../hooks/useSimulation'
import { marketApi } from '../../lib/marketApi'
import { PortfolioValueChart } from '../charts/PortfolioValueChart'
import type { ChatGraphRequest } from './chat.types'

interface HistoryPoint {
  date: string
  close: number
}

interface ChatGraphCardProps {
  graph: ChatGraphRequest
}

const compactCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  })

export function ChatGraphCard({ graph }: ChatGraphCardProps) {
  const { accountId, assets, isLoading: assetsLoading } = useSimulationContext()
  const { transactions, isLoading: transactionsLoading } = useSimulationOrders(accountId, 200)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const asset = useMemo(
    () => graph.symbol ? assets.find(item => item.symbol === graph.symbol) : undefined,
    [assets, graph.symbol],
  )

  useEffect(() => {
    if (graph.kind !== 'asset_graph' || !graph.symbol || !graph.type) {
      setHistory([])
      setHistoryError(null)
      return
    }

    let isActive = true

    const loadHistory = async () => {
      setHistoryLoading(true)
      setHistoryError(null)
      try {
        const result = await marketApi.getMarketHistory(graph.symbol!, graph.type!)
        if (!isActive) {
          return
        }
        setHistory(result.slice(-30))
      } catch {
        if (!isActive) {
          return
        }
        setHistory([])
        setHistoryError('Unable to load chart data right now.')
      } finally {
        if (isActive) {
          setHistoryLoading(false)
        }
      }
    }

    void loadHistory()

    return () => {
      isActive = false
    }
  }, [graph.kind, graph.symbol, graph.type])

  if (graph.kind === 'portfolio_graph') {
    if (assetsLoading || transactionsLoading) {
      return <p className="text-xs text-black/50">Loading portfolio chart…</p>
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-black/55">
          <span>{assets.length} assets tracked</span>
          <span>{transactions.length} orders</span>
        </div>
        <div className="h-56 rounded-lg bg-white p-2">
          <PortfolioValueChart assets={assets} transactions={transactions} timeframe="all" />
        </div>
      </div>
    )
  }

  const latest = history[history.length - 1]?.close
  const earliest = history[0]?.close
  const isUp = latest != null && earliest != null ? latest >= earliest : true

  if (historyLoading) {
    return <p className="text-xs text-black/50">Loading {graph.symbol} chart…</p>
  }

  if (historyError) {
    return <p className="text-xs text-red-700">{historyError}</p>
  }

  if (history.length < 2) {
    return <p className="text-xs text-black/50">Not enough price history to draw this chart yet.</p>
  }

  const stroke = isUp ? '#16a34a' : '#dc2626'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-black/55">
        <span>{graph.symbol}</span>
        {latest != null && <span>{compactCurrency(latest)}</span>}
      </div>
      {asset && (
        <div className="flex items-center justify-between text-[11px] text-black/45">
          <span>{asset.quantity} units held</span>
          {asset.currentPrice != null && <span>Live {compactCurrency(asset.currentPrice)}</span>}
        </div>
      )}
      <div className="h-44 rounded-lg bg-white p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dbe4f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickFormatter={(value: number) => compactCurrency(value)}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              formatter={(value: number) => [compactCurrency(value), 'Close']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #dbe4f0', fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="close"
              stroke={stroke}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}