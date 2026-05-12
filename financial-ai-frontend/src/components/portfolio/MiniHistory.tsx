import type { Transaction } from '../../lib/types'

interface Props {
  transactions: Transaction[]
  onViewAll?: () => void
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatUSD(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function MiniHistory({ transactions, onViewAll }: Props) {
  // Filter for filled transactions only, most recent first, limit to last 4
  const filledTxs = transactions
    .filter(tx => tx.status === 'FILLED')
    .slice(0, 4)

  if (filledTxs.length === 0) {
    return (
      <div className="rounded-lg border border-black/10 bg-white/85 p-2.5 shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur text-center">
        <p className="text-xs text-black/60">No trades yet</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-black/10 bg-white/85 shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur overflow-hidden flex flex-col h-full">
      <div className="px-3 py-2 border-b border-black/10 shrink-0">
        <h2 className="text-xs font-bold text-black uppercase tracking-wide">Recent Trades</h2>
      </div>
      <div className="pt-2 px-3 pb-3 space-y-2 overflow-y-auto flex-1">
        {filledTxs.map(tx => {
          const isBuy = tx.type === 'BUY'
          return (
            <div key={tx.id} className="flex items-center justify-between pb-2 border-b border-black/5 last:border-b-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wider shrink-0 ${isBuy ? 'text-black' : 'text-black'}`}>
                    {isBuy ? 'BUY' : 'SELL'}
                  </span>
                  <span className="text-xs font-semibold text-black truncate">{tx.asset.symbol}</span>
                  <span className="text-[10px] text-black/50 shrink-0">x{tx.quantity}</span>
                </div>
                <p className="text-[10px] text-black/50 mt-0.5">{formatDate(tx.timestamp)}</p>
              </div>
              <div className="text-right shrink-0 ml-2">
                <p className="text-xs text-black/60">
                  {tx.price != null ? formatUSD(tx.price) : '—'}
                </p>
                {tx.realizedPnL != null && tx.type === 'SELL' && (
                  <p className={`text-[10px] font-semibold mt-0.5 ${tx.realizedPnL >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {tx.realizedPnL >= 0 ? '+' : ''}{formatUSD(tx.realizedPnL)}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {onViewAll && (
        <button
          onClick={onViewAll}
          className="w-full py-2 border-t border-black/10 text-center text-xs font-semibold text-black/60 hover:text-black hover:bg-black/5 transition-colors shrink-0"
        >
          View All
        </button>
      )}
    </div>
  )
}
