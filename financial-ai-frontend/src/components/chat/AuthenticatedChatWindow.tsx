'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AIChatSidebar } from './AIChatSidebar'
import { useAuthenticatedChatWindow } from '../../contexts/AuthenticatedChatContext'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { useSimulationContext } from '../../hooks/useSimulation'

export function AuthenticatedChatWindow() {
  const { effectiveMode, setMode, restoreLastOpenMode, setIsMobile } = useAuthenticatedChatWindow()
  const isMobile = useIsMobile()
  const { accountId } = useSimulationContext()
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const windowRef = useRef<HTMLDivElement>(null)

  // Update context when mobile state changes
  useEffect(() => {
    setIsMobile(isMobile)
  }, [isMobile, setIsMobile])

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag in floating desktop mode
    if (effectiveMode !== 'floating' || isMobile) {
      return
    }

    setIsDragging(true)
    setDragStart({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y })
  }

  useEffect(() => {
    if (!isDragging) {
      return
    }

    const handlePointerMove = (e: PointerEvent) => {
      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y

      // Clamp to viewport with margin to keep the chat reachable
      const minX = -window.innerWidth + 100 // Keep at least 100px of the window visible on the right
      const maxX = window.innerWidth - 100 // Keep at least 100px visible on the left
      const minY = -window.innerHeight + 100 // Keep at least 100px visible on the bottom
      const maxY = window.innerHeight - 100 // Keep at least 100px visible on the top

      setDragOffset({
        x: Math.max(minX, Math.min(maxX, newX)),
        y: Math.max(minY, Math.min(maxY, newY)),
      })
    }

    const handlePointerUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)

    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isDragging, dragStart])

  const handleMinimize = () => {
    setMode('collapsed')
  }

  const handleRestoreFloating = () => {
    setMode('floating')
  }

  const handleExpand = () => {
    setMode('fullscreen')
  }

  const headerActions = isMobile === false ? (
    <>
      <button
        type="button"
        onClick={handleMinimize}
        aria-label="Collapse chat to launcher"
        className="rounded p-2 transition-colors hover:bg-black/5"
        title="Collapse"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M4 5a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zm3 5a1 1 0 011-1h7a1 1 0 110 2H8a1 1 0 01-1-1zm4 5a1 1 0 011-1h3a1 1 0 110 2h-3a1 1 0 01-1-1z" />
        </svg>
      </button>

      {effectiveMode === 'floating' ? (
        <button
          type="button"
          onClick={handleExpand}
          aria-label="Expand chat to fullscreen"
          className="rounded p-2 transition-colors hover:bg-black/5"
          title="Fullscreen"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm14 0a1 1 0 00-1-1h-4a1 1 0 000 2h2.586l-2.293 2.293a1 1 0 101.414 1.414L13 6.414V8a1 1 0 102 0V4zM3 16a1 1 0 001 1h4a1 1 0 100-2H6.414l2.293-2.293a1 1 0 10-1.414-1.414L5 13.586V12a1 1 0 10-2 0v4zm14 0a1 1 0 01-1 1h-4a1 1 0 110-2h2.586l-2.293-2.293a1 1 0 111.414-1.414L13 13.586V12a1 1 0 112 0v4z" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleRestoreFloating}
          aria-label="Minimize chat to floating window"
          className="rounded p-2 transition-colors hover:bg-black/5"
          title="Floating"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" />
          </svg>
        </button>
      )}
    </>
  ) : undefined

  const launcherClassName = 'fixed bottom-4 right-4 z-50 flex h-16 w-16 items-center justify-center rounded-full border border-black/10 bg-white/95 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur transition-transform hover:scale-[1.03]'
  const isCollapsed = effectiveMode === 'collapsed' && !isMobile

  const windowContainerClassName = isCollapsed
    ? 'fixed bottom-4 right-4 z-40 h-[min(72vh,44rem)] w-[26rem] opacity-0 pointer-events-none'
    : effectiveMode === 'fullscreen'
    ? 'fixed inset-0 z-50 bg-[radial-gradient(circle_at_top_left,_rgba(242,225,188,0.75),_transparent_38%),linear-gradient(180deg,_#f7f1e4_0%,_#f4efe6_52%,_#ebe4d3_100%)] p-3 sm:p-4'
    : 'fixed inset-0 z-40 bg-[radial-gradient(circle_at_top_left,_rgba(242,225,188,0.75),_transparent_38%),linear-gradient(180deg,_#f7f1e4_0%,_#f4efe6_52%,_#ebe4d3_100%)] p-3 md:inset-auto md:bottom-4 md:right-4 md:h-[min(72vh,44rem)] md:w-[26rem] md:bg-transparent md:p-0'

  const chatShellClassName = 'flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-black/10 bg-white/92 shadow-[0_28px_90px_rgba(0,0,0,0.12)] backdrop-blur'

  const floatingWindowStyle: React.CSSProperties = effectiveMode === 'floating' && !isMobile
    ? {
        transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
        transition: isDragging ? 'none' : 'transform 0.2s ease-out',
        cursor: isDragging ? 'grabbing' : 'default',
      }
    : {}

  return (
    <>
      <div 
        ref={windowRef}
        className={windowContainerClassName}
        style={floatingWindowStyle}
      >
        <AIChatSidebar
          accountId={accountId}
          mode="simulation"
          headerActions={headerActions}
          containerClassName={chatShellClassName}
          onHeaderPointerDown={effectiveMode === 'floating' && !isMobile ? handleDragStart : undefined}
        />
      </div>

      {isCollapsed && (
        <button
          type="button"
          onClick={restoreLastOpenMode}
          aria-label="Open AI assistant"
          className={launcherClassName}
          title="Open AI assistant"
        >
          <svg className="h-8 w-8 text-black" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="7" y="8" width="10" height="8" rx="3" />
            <path d="M12 4v4M9 2h6" strokeLinecap="round" />
            <circle cx="10" cy="12" r="1" fill="currentColor" stroke="none" />
            <circle cx="14" cy="12" r="1" fill="currentColor" stroke="none" />
            <path d="M10 14.5h4" strokeLinecap="round" />
            <path d="M9 19l1.5-3M15 19l-1.5-3" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </>
  )
}
