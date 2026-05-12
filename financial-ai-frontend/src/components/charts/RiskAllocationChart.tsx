'use client'

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { Asset, AssetTypeFilter } from '../../lib/types'

// Colour per asset type — extend here if new types are added
const TYPE_COLOR: Record<string, string> = {
  STOCK:  '#3b82f6',
  CRYPTO: '#f59e0b',
}

interface Props {
  assets: Asset[]
  assetType: AssetTypeFilter
}

export function RiskAllocationChart({ assets, assetType }: Props) {
  const filtered = assetType === 'all' ? assets : assets.filter(a => a.type === assetType)

  // Aggregate current value by asset type
  const byType = filtered.reduce<Record<string, number>>((acc, a) => {
    if (a.currentPrice == null) return acc
    acc[a.type] = (acc[a.type] ?? 0) + a.quantity * a.currentPrice
    return acc
  }, {})

  const data = Object.entries(byType).map(([name, value]) => ({
    name,
    value: parseFloat(value.toFixed(2)),
  }))

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-400">
        No priced assets to display
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={4}
          dataKey="value"
        >
          {data.map(entry => (
            <Cell key={entry.name} fill={TYPE_COLOR[entry.name] ?? '#8b5cf6'} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number) =>
            [v.toLocaleString('en-US', { style: 'currency', currency: 'USD' }), 'Value']
          }
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
