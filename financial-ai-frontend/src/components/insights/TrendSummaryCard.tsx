'use client'

import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { ErrorMessage } from '../ui/ErrorMessage'
import type { TrendAnalysis } from '../../lib/types'

interface Props {
  data: TrendAnalysis | undefined
  isLoading: boolean
  error: Error | undefined
  onRetry: () => void
}

const SENTIMENT_VARIANT = { bullish: 'green', bearish: 'red', neutral: 'gray' } as const
const TREND_ICON        = { bullish: '↑', bearish: '↓', neutral: '→' }
const TREND_COLOR       = {
  bullish: 'text-emerald-600',
  bearish: 'text-red-500',
  neutral: 'text-slate-400',
}

export function TrendSummaryCard({ data, isLoading, error, onRetry }: Props) {
  return (
    <Card title="Market Trends">
      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage message="Failed to load trend analysis" onRetry={onRetry} />}

      {data && (
        <div className="space-y-4">
          {/* Overall sentiment */}
          <div className="flex items-center gap-2">
            <Badge
              label={data.overallSentiment.toUpperCase()}
              variant={SENTIMENT_VARIANT[data.overallSentiment]}
            />
            <span className="text-xs text-slate-500">Overall Sentiment</span>
          </div>

          {/* Per-asset trends */}
          <div>
            <p className="text-xs text-slate-500 mb-2">Asset Trends</p>
            <div className="space-y-2">
              {data.assetTrends.map(t => (
                <div key={t.symbol} className="flex items-start gap-2">
                  <span className={`text-sm font-bold mt-0.5 shrink-0 ${TREND_COLOR[t.trend]}`}>
                    {TREND_ICON[t.trend]}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-700">{t.symbol}</span>
                    <p className="text-xs text-slate-500 leading-snug">{t.reasoning}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top insights (first 3) */}
          <div>
            <p className="text-xs text-slate-500 mb-2">Key Insights</p>
            <ul className="space-y-1">
              {data.topInsights.slice(0, 3).map((insight, i) => (
                <li key={i} className="text-xs text-slate-600 flex gap-1.5 leading-snug">
                  <span className="text-blue-400 shrink-0 mt-0.5">•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>

          {/* Market outlook */}
          <p className="text-xs text-slate-600 border-t border-slate-100 pt-3 leading-relaxed">
            {data.marketOutlook}
          </p>
        </div>
      )}
    </Card>
  )
}
