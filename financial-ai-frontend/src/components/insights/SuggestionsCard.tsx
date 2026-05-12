'use client'

import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { ErrorMessage } from '../ui/ErrorMessage'
import type { InvestmentSuggestions } from '../../lib/types'

interface Props {
  data: InvestmentSuggestions | undefined
  isLoading: boolean
  error: Error | undefined
  onRetry: () => void
}

const ACTION_VARIANT  = { buy: 'green', sell: 'red', hold: 'gray', rebalance: 'blue' } as const
const PRIORITY_VARIANT = { high: 'red', medium: 'yellow', low: 'gray' } as const

export function SuggestionsCard({ data, isLoading, error, onRetry }: Props) {
  return (
    <Card title="Investment Suggestions">
      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage message="Failed to load suggestions" onRetry={onRetry} />}

      {data && (
        <div className="space-y-4">
          {/* Suggestion list */}
          <div className="space-y-3">
            {data.suggestions.map((s, i) => (
              <div key={i} className="border border-slate-100 rounded-lg p-3 space-y-1.5">
                {/* Action + symbol + priority */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge label={s.action.toUpperCase()} variant={ACTION_VARIANT[s.action]} />
                  <span className="text-xs font-semibold text-slate-800">{s.symbol}</span>
                  <Badge label={s.priority} variant={PRIORITY_VARIANT[s.priority]} />
                </div>
                <p className="text-xs text-slate-600 leading-snug">{s.reasoning}</p>
              </div>
            ))}
          </div>

          {/* Overall strategy summary */}
          <p className="text-xs text-slate-600 border-t border-slate-100 pt-3 leading-relaxed">
            {data.summary}
          </p>
        </div>
      )}
    </Card>
  )
}
