'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '../../lib/auth'
import { simulationApi } from '../../lib/simulationApi'
import { useSimulationContext, useSimulationOrders } from '../../hooks/useSimulation'
import { FilterBar } from '../../components/filters/FilterBar'
import { PortfolioValueChart } from '../../components/charts/PortfolioValueChart'
import { RiskAllocationChart } from '../../components/charts/RiskAllocationChart'
import { TopAssetsChart } from '../../components/charts/TopAssetsChart'
import { AssetPerformanceModal } from '../../components/charts/AssetPerformanceModal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { StockSearchPanel } from '../../components/market/StockSearchPanel'
import { AddAssetModal } from '../../components/portfolio/AddAssetModal'
import { SellAssetModal } from '../../components/portfolio/SellAssetModal'
import { MiniHistory } from '../../components/portfolio/MiniHistory'
import { FullTradingHistoryModal } from '../../components/portfolio/FullTradingHistoryModal'
import type { Asset } from '../../lib/types'
import type { Filters } from '../../lib/types'

export default function DashboardPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const summaryCardClassName = 'rounded-2xl border border-black/10 bg-white/85 p-3.5 shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur xl:p-4'

  useEffect(() => {
    setMounted(true)
    if (!auth.isLoggedIn()) router.replace('/login')
  }, [router])

  const [filters, setFilters] = useState<Filters>({
    assetType: 'all',
    timeframe: 'all',
    riskLevel: 'all',
  })
  const [showAddModal, setShowAddModal]     = useState(false)
  const [sellAsset, setSellAsset]           = useState<Asset | null>(null)
  const [selectedAsset, setSelectedAsset]   = useState<Asset | null>(null)
  const [showFullHistory, setShowFullHistory] = useState(false)

  const { accountId, assets, isLoading: portLoading, error: portError, balance, refresh: refreshPortfolio } =
    useSimulationContext()
  const { transactions, isLoading: txLoading, refresh: refreshOrders } = useSimulationOrders(accountId, 200)

  // Check and execute any pending limit orders on dashboard load
  useEffect(() => {
    if (accountId) {
      simulationApi.executePendingOrders(accountId).then((result) => {
        if (result.count > 0) {
          void refreshPortfolio()
          void refreshOrders()
        }
      }).catch(() => { /* ignore */ })
    }
  }, [accountId]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredAssets = filters.assetType === 'all'
    ? assets : assets.filter(a => a.type === filters.assetType)
  const filteredTxs = filters.assetType === 'all'
    ? transactions : transactions.filter(tx => tx.asset.type === filters.assetType)

  const totalValue  = assets.reduce((sum, a) => sum + (a.currentPrice != null ? a.quantity * a.currentPrice : 0), 0)
  const stockCount  = assets.filter(a => a.type === 'STOCK').length
  const cryptoCount = assets.filter(a => a.type === 'CRYPTO').length

  function handleLogout() {
    auth.clear()
    router.push('/login')
  }

  if (!mounted || !auth.isLoggedIn()) return null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">

      {showAddModal && (
        <AddAssetModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => { void refreshPortfolio(); void refreshOrders() }}
        />
      )}

      {sellAsset && (
        <SellAssetModal
          asset={sellAsset}
          onClose={() => setSellAsset(null)}
          onSold={() => { void refreshPortfolio(); void refreshOrders() }}
        />
      )}

      {selectedAsset && (
        <AssetPerformanceModal
          isOpen={selectedAsset != null}
          symbol={selectedAsset.symbol}
          type={selectedAsset.type}
          onClose={() => setSelectedAsset(null)}
          currentPrice={selectedAsset.currentPrice}
          quantity={selectedAsset.quantity}
          averageCost={selectedAsset.averageCost}
        />
      )}

      <header className="z-10 mb-3 flex shrink-0 items-center justify-between rounded-lg border border-black/10 bg-white/80 px-3 py-2 backdrop-blur sm:px-4 sm:py-2.5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-black/35">Financial AI</p>
          <h1 className="mt-0.5 font-serif text-lg text-black sm:text-xl">Trading Simulator Workspace</h1>
          <p className="mt-1 text-xs text-black/55">Portfolio analytics, paper trading, and your AI copilot in one place.</p>
        </div>
        <div className="flex items-center gap-2.5">
          {(portLoading || txLoading) && <LoadingSpinner size="sm" />}
          <button onClick={() => setShowAddModal(true)} className="swiss-btn-primary text-sm">
            + Buy Asset
          </button>
          <button onClick={handleLogout} className="swiss-btn-sm">
            Logout
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 pb-4 xl:space-y-6 xl:pb-6">

            {portError && (
              <div className="rounded-2xl border border-red-200 bg-red-50/90 px-6 py-4 text-sm text-red-900 shadow-[0_16px_40px_rgba(127,29,29,0.08)]">
                Failed to load portfolio data — check the backend is running and your credentials are valid.
              </div>
            )}

            {/* ── Summary stats ── */}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
              <div className={summaryCardClassName}>
                <p className="text-xs font-semibold text-black/60 uppercase tracking-wide">Portfolio Value</p>
                <p className="text-2xl font-bold text-black mt-2">
                  {totalValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </p>
                <p className="text-xs text-black/40 mt-1">at current prices</p>
              </div>
              <div className={summaryCardClassName}>
                <p className="text-xs font-semibold text-black/60 uppercase tracking-wide">Balance</p>
                <p className="text-2xl font-bold text-black mt-2">
                  {balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </p>
                <p className="text-xs text-black/40 mt-1">cash available to spend</p>
              </div>
              <div className={summaryCardClassName}>
                <p className="text-xs font-semibold text-black/60 uppercase tracking-wide">Assets</p>
                <p className="text-2xl font-bold text-black mt-2">{assets.length}</p>
                <p className="text-xs text-black/40 mt-1">{stockCount} stocks · {cryptoCount} crypto</p>
              </div>
              <div className={summaryCardClassName}>
                <p className="text-xs font-semibold text-black/60 uppercase tracking-wide">Trades</p>
                <p className="text-2xl font-bold text-black mt-2">{transactions.length}</p>
                <p className="text-xs text-black/40 mt-1">filled, open, and canceled orders</p>
              </div>
            </div>

            {/* ── Positions list + Assets by Value ── */}
            {assets.length > 0 && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                {/* Compact Positions List */}
                <div className="swiss-card p-3 xl:p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-black/10">
                    <h2 className="text-sm font-bold text-black uppercase tracking-wide">Positions</h2>
                    <button onClick={() => setShowAddModal(true)} className="swiss-btn-sm text-xs">
                      + Add
                    </button>
                  </div>
                  <div className="pt-3 space-y-2 max-h-64 overflow-y-auto">
                    {assets.map(a => {
                      const posValue = a.currentPrice != null ? a.quantity * a.currentPrice : null
                      const pnl      = a.currentPrice != null ? (a.currentPrice - a.averageCost) * a.quantity : null
                      const pnlUp    = pnl != null && pnl >= 0
                      return (
                        <div key={a.id} className="flex items-center justify-between pb-2 border-b border-black/5 last:border-b-0">
                          <button
                            onClick={() => setSelectedAsset(a)}
                            className="flex items-center gap-2 text-left hover:opacity-75 transition-opacity cursor-pointer flex-1 min-w-0"
                            aria-label={`View ${a.symbol} performance chart`}
                          >
                            <span className="text-[10px] font-bold text-black/40 uppercase tracking-wider shrink-0">{a.type}</span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-black">{a.symbol}</p>
                              {a.companyName && (
                                <p className="text-[10px] text-black/45 line-clamp-1">{a.companyName}</p>
                              )}
                            </div>
                          </button>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <div className="text-right">
                              {posValue != null ? (
                                <p className="text-xs font-semibold text-black">
                                  ${(posValue / 1000).toFixed(1)}k
                                </p>
                              ) : (
                                <p className="text-[10px] text-black/40">—</p>
                              )}
                              {pnl != null && (
                                <p className={`text-[10px] font-semibold mt-0.5 ${pnlUp ? 'text-green-700' : 'text-red-700'}`}>
                                  {pnlUp ? '+' : ''}{pnl.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => setSellAsset(a)}
                              className="swiss-btn-sm text-[10px] px-2 py-1"
                            >
                              Sell
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Compact Assets by Value Chart */}
                <div className="swiss-card p-3 xl:p-4">
                  <h3 className="text-sm font-bold text-black uppercase tracking-wide mb-3">Assets by Value</h3>
                  {portLoading ? (
                    <div className="h-40 flex items-center justify-center"><LoadingSpinner /></div>
                  ) : (
                    <div style={{ height: '160px' }}>
                      <TopAssetsChart assets={assets} assetType={filters.assetType} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Empty state ── */}
            {assets.length === 0 && !portLoading && (
              <div className="swiss-card text-center py-16">
                <p className="text-black/60">No positions yet</p>
                <p className="text-sm text-black/40 mt-2">
                  Ask the AI assistant about any stock, then buy when you&apos;re ready.
                </p>
                <button onClick={() => setShowAddModal(true)} className="swiss-btn-primary text-sm mt-6">
                  + Buy Asset
                </button>
              </div>
            )}

            {/* ── Mini Trading History + Stock Search ── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
              {/* Mini Trading History */}
              <div className="min-h-0">
                <MiniHistory
                  transactions={transactions}
                  onViewAll={() => setShowFullHistory(true)}
                />
              </div>

              {/* Stock Search Panel */}
              <div className="rounded-lg border border-black/10 bg-white/85 shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur overflow-hidden p-0 min-h-0">
                <StockSearchPanel portfolioAssets={assets} />
              </div>
            </div>

            {/* ── Full Trading History Modal ── */}
            <FullTradingHistoryModal
              transactions={transactions}
              accountId={accountId}
              isOpen={showFullHistory}
              onClose={() => setShowFullHistory(false)}
              onOrderCanceled={() => { void refreshPortfolio(); void refreshOrders() }}
            />

            {/* ── Filters ── */}
            {assets.length > 0 && <FilterBar filters={filters} onChange={setFilters} />}

            {/* ── Charts ── */}
            {assets.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 swiss-card">
                  <h3 className="text-base font-bold text-black uppercase tracking-wide mb-6">Portfolio Value Over Time</h3>
                  {portLoading || txLoading ? (
                    <div className="h-52 flex items-center justify-center"><LoadingSpinner /></div>
                  ) : (
                    <PortfolioValueChart assets={filteredAssets} transactions={filteredTxs} timeframe={filters.timeframe} />
                  )}
                </div>
                <div className="swiss-card">
                  <h3 className="text-base font-bold text-black uppercase tracking-wide mb-6">Risk Allocation</h3>
                  {portLoading ? (
                    <div className="h-52 flex items-center justify-center"><LoadingSpinner /></div>
                  ) : (
                    <RiskAllocationChart assets={assets} assetType={filters.assetType} />
                  )}
                </div>
              </div>
            )}
        </div>
      </main>
    </div>
  )
}
