'use client'

import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { simulationApi } from '../../lib/simulationApi'
import { ApiError } from '../../lib/httpClient'
import { cleanResponse } from '../../lib/responseCleanup'
import { AIChatShell } from './AIChatShell'
import type { ChatDisplayMessage } from './chat.types'
import { toChatHistory } from './chat.types'
import { simulationChatHistory } from '../../lib/simulationChatHistory'
import { anonymousRuntime } from '../../lib/anonymousRuntime'

interface SimulationChatControllerProps {
  accountId?: string
  headerActions?: React.ReactNode
  containerClassName?: string
  onHeaderPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void
}

export function SimulationChatController({ accountId, headerActions, containerClassName, onHeaderPointerDown }: SimulationChatControllerProps) {
  const welcomeMessage: ChatDisplayMessage = {
    id: 'welcome-message',
    role: 'ai',
    text: "Hi! I'm your AI trading assistant. Ask me anything about stocks, crypto, or your portfolio — I have full context on your positions and account balance.",
  }
  const [conversation, setConversation] = useState<ChatDisplayMessage[]>([])
  const messages = [welcomeMessage, ...conversation]
  const hasUserMessages = conversation.some(message => message.role === 'user')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [animatingMessageId, setAnimatingMessageId] = useState<string | undefined>()
  const [pendingProposalMessageId, setPendingProposalMessageId] = useState<string | undefined>()
  const [activeGraphMessageId, setActiveGraphMessageId] = useState<string | undefined>()
  const [confirming, setConfirming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Check if there's an active anonymous conversation in the current session.
    // If yes, carry it over into authenticated chat (handoff within same session).
    // If no, load the persisted authenticated chat history from storage.
    const anonymousTranscript = anonymousRuntime.getTranscript()
    if (anonymousTranscript.length > 0) {
      setConversation(anonymousTranscript)
    } else {
      setConversation(simulationChatHistory.load())
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    simulationChatHistory.save(conversation)
  }, [conversation, hydrated])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text = input) {
    const message = text.trim()
    if (!message || loading) {
      return
    }

    if (!accountId) {
      const userMessageId = `user-${Date.now()}-${Math.random()}`
      const loadingMessageId = `loading-${Date.now()}-${Math.random()}`
      const userMessage: ChatDisplayMessage = { id: userMessageId, role: 'user', text: message }
      const loadingMessage: ChatDisplayMessage = {
        id: loadingMessageId,
        role: 'ai',
        text: 'Your account is still loading — try again in a moment.',
      }
      setConversation(prev => [
        ...prev,
        userMessage,
        loadingMessage,
      ])
      setInput('')
      return
    }

    const history = toChatHistory(messages)
    const userMessageId = `user-${Date.now()}-${Math.random()}`
    const userMessage: ChatDisplayMessage = { id: userMessageId, role: 'user', text: message }
    setConversation(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const result = await simulationApi.simulationChat(accountId, message, history)
      setConversation(prev => {
        const assistantMessageId = `assistant-${Date.now()}-${Math.random()}`
        const assistantMessage: ChatDisplayMessage = {
          id: assistantMessageId,
          role: 'ai',
          text: cleanResponse(result.reply),
          ...(result.kind === 'trade_proposal' && { proposal: result.proposal }),
          ...(result.kind === 'trade_executed' && { execution: result.execution }),
          ...(result.kind === 'graph_portfolio' && { graph: { kind: 'portfolio_graph' } }),
          ...(result.kind === 'graph_asset' && { graph: { kind: 'asset_graph', symbol: result.symbol, type: result.type } }),
        }
        const updated: ChatDisplayMessage[] = [...prev, assistantMessage]
        // Trigger animation for the newly added message
        setAnimatingMessageId(assistantMessageId)
        // Track pending proposal for confirm/cancel actions
        if (result.kind === 'trade_proposal') {
          setPendingProposalMessageId(assistantMessageId)
        }
        // Track graph display
        if (result.kind === 'graph_portfolio' || result.kind === 'graph_asset') {
          setActiveGraphMessageId(assistantMessageId)
        }
        return updated
      })
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : 'AI unavailable. Try again.'
      setConversation(prev => {
        const assistantMessageId = `assistant-${Date.now()}-${Math.random()}`
        const assistantMessage: ChatDisplayMessage = {
          id: assistantMessageId,
          role: 'ai',
          text: errorMessage,
        }
        const updated: ChatDisplayMessage[] = [...prev, assistantMessage]
        // Trigger animation for the error message
        setAnimatingMessageId(assistantMessageId)
        return updated
      })
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  async function handleConfirmTrade(messageId: string) {
    // Find the message with this ID to get the proposal
    const message = [...messages].find(m => m.id === messageId)
    if (!message || !message.proposal || !accountId) {
      return
    }

    setConfirming(true)
    try {
      const result = await simulationApi.confirmChatTrade(accountId, {
        side: message.proposal.side,
        symbol: message.proposal.symbol,
        type: message.proposal.type,
        quantity: message.proposal.quantity,
      })

      // Add execution message to conversation
      setConversation(prev => {
        const executionMessageId = `assistant-${Date.now()}-${Math.random()}`
        const executionMessage: ChatDisplayMessage = {
          id: executionMessageId,
          role: 'ai',
          text: cleanResponse(result.reply),
          ...(result.kind === 'trade_executed' && { execution: result.execution }),
        }
        const updated: ChatDisplayMessage[] = [...prev, executionMessage]
        return updated
      })

      // Clear pending proposal
      setPendingProposalMessageId(undefined)

      // Trigger portfolio refresh via custom event
      window.dispatchEvent(new CustomEvent('chat-trade-executed', {
        detail: {
          side: message.proposal.side,
          symbol: message.proposal.symbol,
          quantity: message.proposal.quantity,
        }
      }))
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : 'Trade confirmation failed.'
      setConversation(prev => {
        const errorMessageId = `assistant-${Date.now()}-${Math.random()}`
        const errorMsg: ChatDisplayMessage = {
          id: errorMessageId,
          role: 'ai',
          text: `Trade failed: ${errorMessage}`,
        }
        return [...prev, errorMsg]
      })
    } finally {
      setConfirming(false)
    }
  }

  function handleCancelTrade() {
    // Simply clear the pending proposal — no backend call needed
    setPendingProposalMessageId(undefined)
  }

  return (
    <AIChatShell
      title="Trading Intelligence"
      showSuggestions={hydrated && !hasUserMessages}
      messages={messages}
      input={input}
      loading={loading}
      confirming={confirming}
      pendingProposalMessageId={pendingProposalMessageId}
      activeGraphMessageId={activeGraphMessageId}
      inputDisabled={loading || !accountId}
      canSubmit={!loading && input.trim().length > 0 && Boolean(accountId)}
      placeholder={accountId ? 'Ask about any stock or your portfolio…' : 'Loading account…'}
      bottomRef={bottomRef}
      inputRef={inputRef}
      animatingMessageId={animatingMessageId}
      headerActions={headerActions}
      containerClassName={containerClassName}
      onHeaderPointerDown={onHeaderPointerDown}
      onAnimationComplete={() => setAnimatingMessageId(undefined)}
      onInputChange={setInput}
      onSubmit={() => { void send() }}
      onSuggestionSelect={(text) => { void send(text) }}
      onConfirmTrade={handleConfirmTrade}
      onCancelTrade={handleCancelTrade}
      onCloseGraph={() => setActiveGraphMessageId(undefined)}
    />
  )
}
