// financial-ai-frontend/src/components/portfolio/TradingHistory.tsx
import { useState } from 'react'
import { simulationApi } from '../../lib/simulationApi'
import type { Transaction } from '../../lib/types'

interface Props {
  transactions: Transaction[]
  accountId?: string
  onOrderCanceled?: () => void
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatUSD(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function TradingHistory({ transactions, accountId, onOrderCanceled }: Props) {
  const [cancelingId, setCancelingId] = useState<string | null>(null)

  async function handleCancel(orderId: string) {
    if (!accountId) return
    setCancelingId(orderId)
    try {
      await simulationApi.cancelOrder(accountId, orderId)
      onOrderCanceled?.()
    } catch {
      // silently fail — order may have filled in the meantime
    } finally {
      setCancelingId(null)
    }
  }

  if (transactions.length === 0) {
    return (
      <div className="swiss-card text-center py-10">
        <p className="text-black/60 text-sm">No trades yet</p>
      </div>
    )
  }

  return (
    <div className="swiss-card">
      <h2 className="text-base font-bold text-black uppercase tracking-wide pb-6 border-b border-black/10">
        Trading History
      </h2>
      <div className="overflow-x-auto pt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-black/50 uppercase tracking-wide">
              <th className="pb-3 pr-4">Date</th>
              <th className="pb-3 pr-4">Symbol</th>
              <th className="pb-3 pr-4">Type</th>
              <th className="pb-3 pr-4">Side</th>
              <th className="pb-3 pr-4 text-right">Qty</th>
              <th className="pb-3 pr-4 text-right">Limit</th>
              <th className="pb-3 pr-4 text-right">Bought Each For</th>
              <th className="pb-3 pr-4 text-right">Sold Each For</th>
              <th className="pb-3 pr-4 text-right">P&amp;L</th>
              <th className="pb-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => {
              const isBuy = tx.type === 'BUY'
              const pnlUp = tx.realizedPnL != null && tx.realizedPnL >= 0
              const isOpen = tx.status === 'OPEN'
              const isCanceled = tx.status === 'CANCELED'
              return (
                <tr key={tx.id} className={`border-t border-black/5 ${isCanceled ? 'opacity-40' : ''}`}>
                  <td className="py-3 pr-4 text-black/60 whitespace-nowrap">{formatDate(tx.timestamp)}</td>
                  <td className="py-3 pr-4 font-semibold text-black">{tx.asset.symbol}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-block px-2 py-0.5 text-xs font-bold ${
                      tx.orderType === 'LIMIT'
                        ? 'border border-blue-600 text-blue-600'
                        : 'bg-black/5 text-black/60'
                    }`}>
                      {tx.orderType}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {isBuy ? (
                      <span className="inline-block px-2 py-0.5 text-xs font-bold bg-black text-white">BUY</span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 text-xs font-bold border border-black text-black">SELL</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right text-black">{tx.quantity}</td>
                  <td className="py-3 pr-4 text-right text-black/60">
                    {tx.limitPrice != null ? formatUSD(tx.limitPrice) : '—'}
                  </td>
                  <td className="py-3 pr-4 text-right text-black">
                    {isBuy && tx.price != null ? formatUSD(tx.price) : '—'}
                  </td>
                  <td className="py-3 pr-4 text-right text-black">
                    {!isBuy && tx.price != null ? formatUSD(tx.price) : '—'}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {tx.realizedPnL != null ? (
                      <span className={`font-semibold ${pnlUp ? 'text-green-700' : 'text-red-700'}`}>
                        {pnlUp ? '+' : ''}{formatUSD(tx.realizedPnL)}
                      </span>
                    ) : (
                      <span className="text-black/20">—</span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    {isOpen ? (
                      <button
                        onClick={() => handleCancel(tx.id)}
                        disabled={cancelingId === tx.id}
                        className="px-2 py-1 text-xs font-semibold border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 transition-all"
                      >
                        {cancelingId === tx.id ? '…' : 'Cancel'}
                      </button>
                    ) : (
                      <span className={`text-xs font-semibold ${
                        isCanceled ? 'text-black/30' : 'text-green-700'
                      }`}>
                        {tx.status}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
