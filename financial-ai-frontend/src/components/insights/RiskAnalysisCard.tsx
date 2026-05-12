'use client'

import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { ErrorMessage } from '../ui/ErrorMessage'
import type { RiskAnalysis } from '../../lib/types'

interface Props {
  data: RiskAnalysis | undefined
  isLoading: boolean
  error: Error | undefined
  onRetry: () => void
}

const RISK_VARIANT = { low: 'green', medium: 'yellow', high: 'red' } as const

export function RiskAnalysisCard({ data, isLoading, error, onRetry }: Props) {
  return (
    <Card title="Risk Analysis">
      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage message="Failed to load risk analysis" onRetry={onRetry} />}

      {data && (
        <div className="space-y-4">
          {/* Risk badge + diversification score */}
          <div className="flex items-center justify-between">
            <Badge label={data.riskLevel.toUpperCase()} variant={RISK_VARIANT[data.riskLevel]} />
            <span className="text-xs text-slate-500">
              Diversification{' '}
              <span className="font-semibold text-slate-700">{data.diversificationScore}/10</span>
            </span>
          </div>

          {/* Diversification bar */}
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${data.diversificationScore * 10}%` }}
            />
          </div>

          {/* Total portfolio value */}
          <div>
            <p className="text-xs text-slate-500">Portfolio Value</p>
            <p className="text-lg font-bold text-slate-900">
              {data.totalPortfolioValue.toLocaleString('en-US', {
                style: 'currency', currency: 'USD',
              })}
            </p>
          </div>

          {/* Sector exposure */}
          {Object.keys(data.sectorExposure).length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Sector Exposure</p>
              <div className="space-y-1.5">
                {Object.entries(data.sectorExposure).map(([sector, pct]) => (
                  <div key={sector} className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-600 w-24 text-right shrink-0">
                      {sector} {pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Concentration warnings */}
          {data.concentrationWarnings.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Warnings</p>
              <ul className="space-y-1">
                {data.concentrationWarnings.map((w, i) => (
                  <li key={i} className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                    ⚠ {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI recommendation */}
          <p className="text-xs text-slate-600 border-t border-slate-100 pt-3 leading-relaxed">
            {data.recommendation}
          </p>
        </div>
      )}
    </Card>
  )
}
