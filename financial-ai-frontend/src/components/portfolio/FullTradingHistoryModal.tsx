import { simulationApi } from '../../lib/simulationApi'
import type { Transaction } from '../../lib/types'

interface Props {
  transactions: Transaction[]
  accountId?: string
  isOpen: boolean
  onClose: () => void
  onOrderCanceled?: () => void
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatUSD(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function FullTradingHistoryModal({ transactions, accountId, isOpen, onClose, onOrderCanceled }: Props) {
  if (!isOpen) return null

  const handleCancel = async (orderId: string) => {
    if (!accountId) return
    try {
      await simulationApi.cancelOrder(accountId, orderId)
      onOrderCanceled?.()
    } catch {
      // silently fail
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] overflow-auto rounded-t-2xl sm:rounded-2xl border border-black/10 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-black/10 px-6 py-6 sm:px-8 sm:py-8 flex items-center justify-between">
          <h2 className="text-xl font-bold text-black uppercase tracking-wide">Trading History</h2>
          <button
            onClick={onClose}
            className="text-black/60 hover:text-black text-2xl transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8">
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-black/60">No trades yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-black/50 uppercase tracking-wide">
                    <th className="pb-3 pr-4 whitespace-nowrap">Date</th>
                    <th className="pb-3 pr-4">Symbol</th>
                    <th className="pb-3 pr-4">Side</th>
                    <th className="pb-3 pr-4 text-right">Qty</th>
                    <th className="pb-3 pr-4 text-right">Bought Each For</th>
                    <th className="pb-3 pr-4 text-right">Sold Each For</th>
                    <th className="pb-3 pr-4 text-right">Profit / Loss</th>
                    <th className="pb-3 pr-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => {
                    const isBuy = tx.type === 'BUY'
                    const pnlUp = tx.realizedPnL != null && tx.realizedPnL >= 0
                    const isOpen = tx.status === 'OPEN'
                    const isCanceled = tx.status === 'CANCELED'
                    const costBasis = isBuy ? tx.price : tx.costBasisPerUnit
                    
                    return (
                      <tr key={tx.id} className={`border-t border-black/5 ${isCanceled ? 'opacity-40' : ''}`}>
                        <td className="py-3 pr-4 text-black/60 whitespace-nowrap text-xs">{formatDate(tx.timestamp)}</td>
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-black">{tx.asset.symbol}</p>
                          {tx.companyName && (
                            <p className="text-xs text-black/45 mt-0.5">{tx.companyName}</p>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {isBuy ? (
                            <span className="inline-block px-2 py-0.5 text-xs font-bold bg-black text-white rounded">BUY</span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 text-xs font-bold border border-black text-black rounded">SELL</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right text-black">{tx.quantity}</td>
                        <td className="py-3 pr-4 text-right text-black">
                          {costBasis != null ? formatUSD(costBasis) : '—'}
                        </td>
                        <td className="py-3 pr-4 text-right text-black">
                          {!isBuy && tx.price != null ? formatUSD(tx.price) : '—'}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {!isBuy && tx.realizedPnL != null ? (
                            <span className={`font-semibold ${pnlUp ? 'text-green-700' : 'text-red-700'}`}>
                              {pnlUp ? '+' : ''}{formatUSD(tx.realizedPnL)}
                            </span>
                          ) : (
                            <span className="text-black/20">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {isOpen ? (
                            <button
                              onClick={() => handleCancel(tx.id)}
                              className="px-2 py-1 text-xs font-semibold border border-red-300 text-red-700 hover:bg-red-50 transition-all rounded"
                            >
                              Cancel
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
          )}
        </div>
      </div>
    </div>
  )
}
