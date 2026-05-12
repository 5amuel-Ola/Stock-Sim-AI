'use client'

import { useState } from 'react'
import { AIChatSidebar } from './AIChatSidebar'
import { StockSearchPanel } from '../market/StockSearchPanel'
import type { Asset } from '../../lib/types'

interface Props {
  accountId: string | undefined
  portfolioAssets: Asset[]
}

type Tab = 'chat' | 'markets'

export function LeftPanel({ accountId, portfolioAssets }: Props) {
  const [tab, setTab] = useState<Tab>('chat')

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-black/10">
        {(['chat', 'markets'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
              tab === t
                ? 'text-black border-b-2 border-black -mb-px'
                : 'text-black/35 hover:text-black/60'
            }`}
          >
            {t === 'chat' ? 'AI Chat' : 'Markets'}
          </button>
        ))}
      </div>

      {/* Panel content — both mounted, only one visible, so chat history survives tab switches */}
      <div className={`flex-1 min-h-0 ${tab === 'chat' ? 'flex flex-col' : 'hidden'}`}>
        <AIChatSidebar accountId={accountId} mode="simulation" />
      </div>
      <div className={`flex-1 min-h-0 overflow-hidden ${tab === 'markets' ? 'flex flex-col' : 'hidden'}`}>
        <StockSearchPanel portfolioAssets={portfolioAssets} />
      </div>
    </div>
  )
}
