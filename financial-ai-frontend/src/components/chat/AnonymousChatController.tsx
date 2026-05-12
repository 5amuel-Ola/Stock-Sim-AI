'use client'

import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { aiApi } from '../../lib/aiApi'
import { ApiError } from '../../lib/httpClient'
import { cleanResponse } from '../../lib/responseCleanup'
import { AIChatShell } from './AIChatShell'
import type { ChatDisplayMessage } from './chat.types'
import { toChatHistory } from './chat.types'
import { anonymousRuntime } from '../../lib/anonymousRuntime'

interface AnonymousChatControllerProps {
  onUpgradeRequired?: () => void
  starterPrompt?: { id: number; text: string } | null
  onStateChange?: (state: { remainingMessages: number | null; loading: boolean }) => void
  headerActions?: React.ReactNode
  containerClassName?: string
  onHeaderPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void
}

export function AnonymousChatController({ onUpgradeRequired, starterPrompt, onStateChange, headerActions, containerClassName, onHeaderPointerDown }: AnonymousChatControllerProps) {
  const router = useRouter()
  const welcomeMessage: ChatDisplayMessage = {
    id: 'welcome-message',
    role: 'ai',
    text: "Hi! I'm your Financial AI assistant. Ask about stocks, crypto, or market ideas. You can use 7 anonymous messages before creating an account.",
  }
  const [conversation, setConversation] = useState<ChatDisplayMessage[]>([])
  const messages = [welcomeMessage, ...conversation]
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [remainingMessages, setRemainingMessages] = useState<number | null>(7)
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [animatingMessageId, setAnimatingMessageId] = useState<string | undefined>()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastStarterPromptId = useRef<number | null>(null)

  useEffect(() => {
    setConversation(anonymousRuntime.getTranscript())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    anonymousRuntime.setTranscript(conversation)
  }, [conversation, hydrated])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    onStateChange?.({ remainingMessages, loading })
  }, [remainingMessages, loading, onStateChange])

  useEffect(() => {
    if (!starterPrompt || starterPrompt.id === lastStarterPromptId.current) {
      return
    }

    lastStarterPromptId.current = starterPrompt.id
    void send(starterPrompt.text)
  }, [starterPrompt])

  async function send(text = input) {
    const message = text.trim()
    if (!message || loading || upgradeRequired) {
      return
    }

    const history = toChatHistory(messages)
    const userMessageId = `user-${Date.now()}-${Math.random()}`
    const userMessage: ChatDisplayMessage = { id: userMessageId, role: 'user', text: message }
    setConversation(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const result = await aiApi.aiChat(message, history)
      if (typeof result.remainingMessages === 'number') {
        setRemainingMessages(result.remainingMessages)
      }
      setConversation(prev => {
        const assistantMessageId = `assistant-${Date.now()}-${Math.random()}`
        const assistantMessage: ChatDisplayMessage = {
          id: assistantMessageId,
          role: 'ai',
          text: cleanResponse(result.reply),
        }
        const updated: ChatDisplayMessage[] = [...prev, assistantMessage]
        // Trigger animation for the newly added message
        setAnimatingMessageId(assistantMessageId)
        return updated
      })
    } catch (error) {
      let errorMessage = error instanceof ApiError ? error.message : 'AI unavailable. Try again.'

      if (error instanceof ApiError && error.code === 'UPGRADE_REQUIRED') {
        setUpgradeRequired(true)
        setRemainingMessages(typeof error.details?.remainingMessages === 'number' ? error.details.remainingMessages : 0)
        errorMessage = 'You have reached the anonymous chat limit. Create an account to continue the conversation.'
        onUpgradeRequired?.()
      }

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

  return (
    <AIChatShell
      title="Market Chat"
      showSuggestions={false}
      badge={(
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-black/35">Anonymous</p>
          <p className="text-xs text-black/60">
            {remainingMessages != null ? `${remainingMessages} left` : '7 max'}
          </p>
        </div>
      )}
      messages={messages}
      input={input}
      loading={loading}
      inputDisabled={loading || upgradeRequired}
      canSubmit={!loading && !upgradeRequired && input.trim().length > 0}
      placeholder="Ask about any stock or market theme…"
      footer={(
        <div className="shrink-0 border-t border-black/10 bg-black/[0.02] px-4 py-3 xl:px-6">
          {upgradeRequired ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-black/70">Anonymous limit reached. Register or sign in to continue.</p>
              <button
                type="button"
                onClick={() => router.push('/login?mode=register&next=/dashboard')}
                className="px-3 py-2 text-xs font-semibold border border-black text-black hover:bg-black hover:text-white transition-all"
              >
                Continue
              </button>
            </div>
          ) : (
            <p className="text-xs text-black/55">
              Anonymous chat is limited to 7 messages. Your session stays attached to the same browser.
            </p>
          )}
        </div>
      )}
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
    />
  )
}
