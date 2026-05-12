'use client'

import type { AssetTypeFilter, TimeframeFilter, RiskLevelFilter, Filters } from '../../lib/types'

interface FilterBarProps {
  filters: Filters
  onChange: (f: Filters) => void
}

// Generic segmented control — reused for all three filter groups
function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-slate-500 shrink-0">{label}</span>
      <div className="flex rounded-lg border border-slate-200 overflow-hidden divide-x divide-slate-200">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              value === opt.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const ASSET_OPTIONS: { label: string; value: AssetTypeFilter }[] = [
  { label: 'All',    value: 'all' },
  { label: 'Stocks', value: 'STOCK' },
  { label: 'Crypto', value: 'CRYPTO' },
]

const TIMEFRAME_OPTIONS: { label: string; value: TimeframeFilter }[] = [
  { label: '1W',  value: '1W' },
  { label: '1M',  value: '1M' },
  { label: '3M',  value: '3M' },
  { label: 'All', value: 'all' },
]

const RISK_OPTIONS: { label: string; value: RiskLevelFilter }[] = [
  { label: 'All',    value: 'all' },
  { label: 'Low',    value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High',   value: 'high' },
]

export function FilterBar({ filters, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3.5">
      <SegmentedControl
        label="Asset:"
        options={ASSET_OPTIONS}
        value={filters.assetType}
        onChange={v => onChange({ ...filters, assetType: v })}
      />
      <SegmentedControl
        label="Timeframe:"
        options={TIMEFRAME_OPTIONS}
        value={filters.timeframe}
        onChange={v => onChange({ ...filters, timeframe: v })}
      />
      <SegmentedControl
        label="Risk:"
        options={RISK_OPTIONS}
        value={filters.riskLevel}
        onChange={v => onChange({ ...filters, riskLevel: v })}
      />
    </div>
  )
}
