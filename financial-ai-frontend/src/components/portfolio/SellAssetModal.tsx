'use client'

import { useState } from 'react'
import { ApiError } from '../../lib/httpClient'
import { simulationApi } from '../../lib/simulationApi'
import { useSimulationContext } from '../../hooks/useSimulation'
import type { Asset } from '../../lib/types'

interface Props {
  asset: Asset
  onClose: () => void
  onSold: () => void
}

export function SellAssetModal({ asset, onClose, onSold }: Props) {
  const { accountId } = useSimulationContext()
  const [quantity, setQuantity] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)

  const qty         = parseFloat(quantity)
  const validQty    = !isNaN(qty) && qty > 0 && qty <= asset.quantity
  const price       = asset.currentPrice
  const proceeds    = validQty && price != null ? qty * price : null
  const costBasis   = validQty ? qty * asset.averageCost : null
  const pnl         = proceeds != null && costBasis != null ? proceeds - costBasis : null
  const pnlPositive = pnl != null && pnl >= 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!accountId) return setError('Account not initialized — please refresh')
    if (!validQty)  return setError(`Enter a quantity between 0 and ${asset.quantity}`)

    setSaving(true)
    try {
      await simulationApi.executeTrade(accountId, {
        symbol:   asset.symbol,
        type:     asset.type,
        side:     'SELL',
        quantity: qty,
      })
      onSold()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to sell asset')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white border border-black/10 w-full max-w-md p-8">

        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-black/10">
          <div>
            <h2 className="text-xl font-bold text-black">Sell {asset.symbol}</h2>
            <p className="text-xs text-black/40 mt-0.5">{asset.type}</p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl text-black/40 hover:text-black/60 leading-none font-light"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Position summary */}
        <div className="mt-6 grid grid-cols-3 gap-4 pb-6 border-b border-black/10">
          <div>
            <p className="text-xs text-black/40 uppercase tracking-wide">Held</p>
            <p className="text-base font-bold text-black mt-1">{asset.quantity}</p>
          </div>
          <div>
            <p className="text-xs text-black/40 uppercase tracking-wide">Avg Cost</p>
            <p className="text-base font-bold text-black mt-1">
              ${asset.averageCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-black/40 uppercase tracking-wide">Current</p>
            <p className="text-base font-bold text-black mt-1">
              {price != null
                ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '—'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="pt-6 space-y-6">

          {/* Quantity input */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-black uppercase tracking-wide">
                Quantity to Sell
              </label>
              <button
                type="button"
                onClick={() => setQuantity(String(asset.quantity))}
                className="text-xs font-semibold text-black/50 hover:text-black underline underline-offset-2 transition-all"
              >
                Sell All
              </button>
            </div>
            <input
              type="number"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder={`Max ${asset.quantity}`}
              min="0"
              max={asset.quantity}
              step="any"
              className="swiss-input w-full"
              autoFocus
            />
          </div>

          {/* Preview */}
          {validQty && (
            <div className="bg-black/[0.02] border border-black/10 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-black/50">Proceeds</span>
                <span className="font-semibold text-black">
                  {proceeds != null
                    ? proceeds.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-black/50">Cost basis</span>
                <span className="font-semibold text-black">
                  {costBasis != null
                    ? costBasis.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                    : '—'}
                </span>
              </div>
              {pnl != null && (
                <div className="flex justify-between text-sm border-t border-black/10 pt-2 mt-2">
                  <span className="text-black/50">Realized P&amp;L</span>
                  <span className={`font-bold ${pnlPositive ? 'text-green-700' : 'text-red-700'}`}>
                    {pnlPositive ? '+' : ''}
                    {pnl.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="text-sm text-red-900 bg-red-50 border border-red-200 p-4">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 text-sm font-medium text-black bg-white border border-black/20 hover:bg-black/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !validQty}
              className="flex-1 py-2 px-4 text-sm font-medium text-white bg-black hover:bg-gray-800 disabled:opacity-50 transition-all"
            >
              {saving ? 'Selling…' : `Sell ${validQty ? qty : ''}`}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
