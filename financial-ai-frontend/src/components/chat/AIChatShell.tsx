'use client'

import React from 'react'
import type { ReactNode, RefObject } from 'react'
import { useTypingAnimation } from '../../hooks/useTypingAnimation'
import { ChatGraphCard } from './ChatGraphCard'
import type { ChatDisplayMessage } from './chat.types'

// Extracted message renderer with stable component identity
function MessageContent({ message, animatingMessageId, onAnimationComplete }: {
  message: ChatDisplayMessage
  animatingMessageId?: string
  onAnimationComplete?: () => void
}) {
  const isAnimating = message.role === 'ai' && message.id === animatingMessageId
  const displayedText = useTypingAnimation({
    text: message.text,
    speed: 15,
    enabled: isAnimating,
    onComplete: isAnimating ? onAnimationComplete : undefined,
  })

  return isAnimating ? displayedText : message.text
}

const SUGGESTIONS = [
  'Is AAPL a good buy right now?',
  'How diversified is my portfolio?',
  'What are the risks of holding NVDA?',
]

interface AIChatShellProps {
  title: string
  badge?: ReactNode
  messages: ChatDisplayMessage[]
  input: string
  loading: boolean
  confirming?: boolean
  pendingProposalMessageId?: string
  activeGraphMessageId?: string
  inputDisabled: boolean
  canSubmit: boolean
  placeholder: string
  footer?: ReactNode
  bottomRef: RefObject<HTMLDivElement>
  inputRef: RefObject<HTMLInputElement>
  animatingMessageId?: string
  showSuggestions?: boolean
  headerActions?: ReactNode
  containerClassName?: string
  onHeaderPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void
  onInputChange(value: string): void
  onSubmit(): void
  onSuggestionSelect(text: string): void
  onAnimationComplete?(): void
  onConfirmTrade?(messageId: string): void
  onCancelTrade?(): void
  onCloseGraph?(): void
}

export function AIChatShell({
  title,
  badge,
  messages,
  input,
  loading,
  confirming,
  pendingProposalMessageId,
  activeGraphMessageId,
  inputDisabled,
  canSubmit,
  placeholder,
  footer,
  bottomRef,
  inputRef,
  animatingMessageId,
  showSuggestions = true,
  headerActions,
  containerClassName,
  onHeaderPointerDown,
  onInputChange,
  onSubmit,
  onSuggestionSelect,
  onAnimationComplete,
  onConfirmTrade,
  onCancelTrade,
  onCloseGraph,
}: AIChatShellProps) {

  const containerClasses = containerClassName || 'flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/92 shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur'

  return (
    <aside className={containerClasses}>
      <div 
        onPointerDown={onHeaderPointerDown}
        className={`shrink-0 border-b border-black/10 bg-white/80 px-3 py-3 backdrop-blur xl:px-5 xl:py-4 ${onHeaderPointerDown ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-black/40">AI Assistant</p>
        <div className="flex items-start justify-between gap-4 mt-1">
          <h2 className="text-base font-bold text-black">{title}</h2>
          <div className="flex items-center gap-2 ml-auto">
            {badge}
            {headerActions}
          </div>
        </div>
      </div>

      {showSuggestions && (
        <div className="shrink-0 border-b border-black/10 bg-[#fbf7ee]/70 px-3 py-2.5 xl:px-5 xl:py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-black/40">Quick questions</p>
          <div className="flex max-h-28 flex-col gap-1.5 overflow-y-auto pr-1 xl:max-h-32">
            {SUGGESTIONS.map(suggestion => (
              <button
                key={suggestion}
                onClick={() => onSuggestionSelect(suggestion)}
                disabled={inputDisabled}
                className="rounded-lg border border-black/10 bg-white/90 px-2.5 py-1.5 text-left text-xs text-black/60 transition-all hover:-translate-y-0.5 hover:border-black hover:bg-[#f6efdf] hover:text-black disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5 space-y-2.5 xl:px-5 xl:py-3">
        {messages.map((message) => (
          <div key={message.id}>
            <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'ai' && (
                <span className="text-xs font-bold text-black/30 uppercase tracking-wide mr-2 mt-1 shrink-0">AI</span>
              )}
              <div
                className={`max-w-[88%] px-3 py-2 text-[13px] leading-relaxed rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-black text-white'
                    : 'bg-black/[0.03] border border-black/10 text-black'
                }`}
              >
                <MessageContent
                  message={message}
                  animatingMessageId={animatingMessageId}
                  onAnimationComplete={onAnimationComplete}
                />
              </div>
            </div>

            {/* Trade Proposal Card */}
            {message.proposal && message.id === pendingProposalMessageId && (
              <div className="mt-2 ml-8 max-w-sm border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
                <div className="font-semibold text-sm text-black">
                  {message.proposal.side === 'BUY' ? '🟢 Buy Order' : '🔴 Sell Order'}
                </div>
                <div className="space-y-2 text-xs text-black/70">
                  <div className="flex justify-between">
                    <span>Asset:</span>
                    <span className="font-semibold text-black">{message.proposal.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quantity:</span>
                    <span className="font-semibold text-black">{message.proposal.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Est. Price:</span>
                    <span className="font-semibold text-black">${message.proposal.estimatedPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-amber-200 pt-2">
                    <span>Est. Total:</span>
                    <span className="font-semibold text-black">${message.proposal.estimatedTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Balance After:</span>
                    <span className="font-semibold text-black">${message.proposal.projectedBalanceAfter.toFixed(2)}</span>
                  </div>
                </div>
                {message.proposal.warnings.length > 0 && (
                  <div className="bg-amber-100 border border-amber-300 rounded px-2 py-1">
                    <p className="text-xs font-semibold text-amber-900">Warnings:</p>
                    <ul className="text-xs text-amber-800 mt-1 space-y-1">
                      {message.proposal.warnings.map((warning, idx) => (
                        <li key={idx}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => onConfirmTrade?.(message.id)}
                    disabled={confirming}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors"
                  >
                    {confirming ? 'Confirming...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => onCancelTrade?.()}
                    disabled={confirming}
                    className="flex-1 bg-red-200 hover:bg-red-300 disabled:bg-gray-200 text-red-900 font-semibold py-2 px-3 rounded-lg text-xs transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Trade Execution Card */}
            {message.execution && (
              <div className="mt-2 ml-8 max-w-sm border border-green-200 bg-green-50 rounded-xl p-4 space-y-3">
                <div className="font-semibold text-sm text-green-900">
                  ✓ Trade Executed
                </div>
                <div className="space-y-2 text-xs text-black/70">
                  <div className="flex justify-between">
                    <span>Type:</span>
                    <span className="font-semibold text-black">{message.execution.side === 'BUY' ? 'Buy' : 'Sell'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Asset:</span>
                    <span className="font-semibold text-black">{message.execution.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quantity:</span>
                    <span className="font-semibold text-black">{message.execution.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fill Price:</span>
                    <span className="font-semibold text-black">${message.execution.fillPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-green-200 pt-2">
                    <span>Total:</span>
                    <span className="font-semibold text-black">${message.execution.totalValue.toFixed(2)}</span>
                  </div>
                  {message.execution.realizedPnL !== null && (
                    <div className="flex justify-between">
                      <span>Realized P&L:</span>
                      <span className={`font-semibold ${message.execution.realizedPnL >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${message.execution.realizedPnL.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>New Balance:</span>
                    <span className="font-semibold text-black">${message.execution.balanceAfter.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Graph Display Card */}
            {message.graph && message.id === activeGraphMessageId && (
              <div className="mt-2 ml-8 max-w-[36rem] border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm text-blue-900">
                    📊 {message.graph.kind === 'portfolio_graph' ? 'Portfolio Value' : 'Asset Performance'}
                  </div>
                  <button
                    onClick={() => onCloseGraph?.()}
                    className="text-sm text-blue-700 hover:text-blue-900 font-semibold"
                  >
                    ✕
                  </button>
                </div>
                <ChatGraphCard graph={message.graph} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <span className="text-xs font-bold text-black/30 uppercase tracking-wide mr-2 mt-1 shrink-0">AI</span>
            <div className="border border-black/10 bg-black/[0.03] px-3 py-2 text-[13px] text-black/40 rounded-2xl">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {footer}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
        className="flex shrink-0 border-t border-black/10 bg-white/85 backdrop-blur"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={event => onInputChange(event.target.value)}
          placeholder={placeholder}
          disabled={inputDisabled}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-black/30 disabled:bg-black/[0.02] xl:px-5 xl:py-3 rounded-l-lg"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="shrink-0 rounded-r-lg border-l border-black/10 bg-black px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-transparent hover:text-black disabled:cursor-not-allowed disabled:bg-black/20 disabled:text-white/80 xl:px-5 xl:py-3"
        >
          Send
        </button>
      </form>
    </aside>
  )
}
