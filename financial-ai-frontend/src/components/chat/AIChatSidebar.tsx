'use client'

import React from 'react'

import { AnonymousChatController } from './AnonymousChatController'
import { SimulationChatController } from './SimulationChatController'

interface Props {
  accountId?: string
  mode: 'simulation' | 'anonymous'
  onUpgradeRequired?: () => void
  starterPrompt?: { id: number; text: string } | null
  onStateChange?: (state: { remainingMessages: number | null; loading: boolean }) => void
  headerActions?: React.ReactNode
  containerClassName?: string
  onHeaderPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void
}

export function AIChatSidebar({ accountId, mode, onUpgradeRequired, starterPrompt, onStateChange, headerActions, containerClassName, onHeaderPointerDown }: Props) {
  if (mode === 'simulation') {
    return <SimulationChatController accountId={accountId} headerActions={headerActions} containerClassName={containerClassName} onHeaderPointerDown={onHeaderPointerDown} />
  }

  return <AnonymousChatController onUpgradeRequired={onUpgradeRequired} starterPrompt={starterPrompt} onStateChange={onStateChange} headerActions={headerActions} containerClassName={containerClassName} onHeaderPointerDown={onHeaderPointerDown} />
}
