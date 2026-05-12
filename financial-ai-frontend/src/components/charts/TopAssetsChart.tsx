'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { Asset, AssetTypeFilter } from '../../lib/types'

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

interface Props {
  assets: Asset[]
  assetType: AssetTypeFilter
}

export function TopAssetsChart({ assets, assetType }: Props) {
  const data = (assetType === 'all' ? assets : assets.filter(a => a.type === assetType))
    .filter(a => a.currentPrice != null)
    .map(a => ({
      symbol: a.symbol,
      value: parseFloat((a.quantity * a.currentPrice!).toFixed(2)),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8) // show at most 8 bars so labels stay readable

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-400">
        No priced assets to display
      </div>
    )
  }

  const fmt = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="symbol" tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={52} />
        <Tooltip
          formatter={(v: number) =>
            [v.toLocaleString('en-US', { style: 'currency', currency: 'USD' }), 'Value']
          }
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={entry.symbol} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
