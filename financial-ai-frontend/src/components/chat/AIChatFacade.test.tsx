import React from "react"
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AIChatSidebar } from './AIChatSidebar'
import { AuthenticatedChatWindow } from './AuthenticatedChatWindow'
import { aiApi } from '../../lib/aiApi'
import { simulationApi } from '../../lib/simulationApi'
import { simulationChatHistory } from '../../lib/simulationChatHistory'
import { anonymousRuntime } from '../../lib/anonymousRuntime'
import { AuthenticatedChatProvider } from '../../contexts/AuthenticatedChatContext'

const push = vi.fn()
window.HTMLElement.prototype.scrollIntoView = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('../../lib/aiApi', () => ({
  aiApi: {
    aiChat: vi.fn(),
  },
}))

vi.mock('../../lib/simulationApi', () => ({
  simulationApi: {
    simulationChat: vi.fn(),
    confirmChatTrade: vi.fn(),
  },
}))

vi.mock('../../hooks/useSimulation', () => ({
  useSimulationContext: () => ({ accountId: 'acct-1' }),
}))

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('AIChatSidebar facade composition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    simulationChatHistory.clear()
    anonymousRuntime.reset()
    mockMatchMedia(false)
  })

  it('hides quick questions in anonymous market chat', () => {
    render(<AIChatSidebar mode="anonymous" />)

    expect(screen.queryByText('Quick questions')).toBeNull()
  })

  it('routes simulation mode through the simulation controller and hides anonymous state', async () => {
    vi.mocked(simulationApi.simulationChat).mockResolvedValue({ kind: 'message', reply: 'Simulation reply' })

    render(<AIChatSidebar mode="simulation" accountId="acct-1" />)

    expect(screen.queryByText('Anonymous')).toBeNull()
    expect(screen.queryByText(/7 max|left/)).toBeNull()
    expect(screen.getByText('Quick questions')).toBeTruthy()

    await userEvent.type(
      screen.getByPlaceholderText('Ask about any stock or your portfolio…'),
      'How is AAPL doing?'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(simulationApi.simulationChat).toHaveBeenCalledWith('acct-1', 'How is AAPL doing?', [])
    })

    expect(aiApi.aiChat).not.toHaveBeenCalled()
    expect(await screen.findByText('Simulation reply', {}, { timeout: 5000 })).toBeTruthy()
    expect(screen.queryByText('Quick questions')).toBeNull()
  })

  it('routes anonymous mode through the anonymous controller and keeps message-limit UI', async () => {
    vi.mocked(aiApi.aiChat).mockResolvedValue({
      reply: 'Anonymous reply',
      remainingMessages: 5,
    })

    render(<AIChatSidebar mode="anonymous" />)

    expect(screen.getByText('Anonymous')).toBeTruthy()
    expect(screen.getByText('7 left')).toBeTruthy()

    await userEvent.type(
      screen.getByPlaceholderText('Ask about any stock or market theme…'),
      'What about NVDA?'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(aiApi.aiChat).toHaveBeenCalledWith('What about NVDA?', [])
    })

    expect(simulationApi.simulationChat).not.toHaveBeenCalled()
    expect(await screen.findByText('Anonymous reply', {}, { timeout: 5000 })).toBeTruthy()
    expect(screen.getByText('5 left')).toBeTruthy()
  })

  it('loads anonymous runtime transcript and persists within the session', async () => {
    // Simulate an active anonymous conversation in runtime (already in session)
    anonymousRuntime.setTranscript([
      { id: 'msg-1', role: 'user', text: 'Session question' },
      { id: 'msg-2', role: 'ai', text: 'Session answer' },
    ])

    render(<AIChatSidebar mode="anonymous" />)

    expect(screen.getByText('Session question')).toBeTruthy()
    expect(screen.getByText('Session answer')).toBeTruthy()

    // Verify the runtime still holds the transcript after rendering
    await waitFor(() => {
      const transcript = anonymousRuntime.getTranscript()
      expect(transcript).toEqual([
        { id: 'msg-1', role: 'user', text: 'Session question' },
        { id: 'msg-2', role: 'ai', text: 'Session answer' },
      ])
    })
  })

  it('carries anonymous chat history into the authenticated simulation chat', async () => {
    vi.mocked(aiApi.aiChat).mockResolvedValue({
      reply: 'Anonymous answer',
      remainingMessages: 6,
    })
    vi.mocked(simulationApi.simulationChat).mockResolvedValue({
      kind: 'message',
      reply: 'Simulation follow-up',
    })

    const { unmount } = render(<AIChatSidebar mode="anonymous" />)

    await userEvent.type(
      screen.getByPlaceholderText('Ask about any stock or market theme…'),
      'What do you think about BTC?'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    await screen.findByText('Anonymous answer', {}, { timeout: 5000 })
    unmount()

    render(<AIChatSidebar mode="simulation" accountId="acct-1" />)

    expect(screen.getByText('What do you think about BTC?')).toBeTruthy()
    expect(screen.getByText('Anonymous answer')).toBeTruthy()

    await userEvent.type(
      screen.getByPlaceholderText('Ask about any stock or your portfolio…'),
      'How does that fit with my account?'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(simulationApi.simulationChat).toHaveBeenCalledWith('acct-1', 'How does that fit with my account?', [
        { role: 'user', content: 'What do you think about BTC?' },
        { role: 'assistant', content: 'Anonymous answer' },
      ])
    })

    expect(await screen.findByText('Simulation follow-up', {}, { timeout: 5000 })).toBeTruthy()
  })

  it('does not restart typing animation when user types during response', async () => {
    // Mock a longer response to give time for typing to occur during animation
    const longReply = 'This is a comprehensive answer about stock market investment strategies and portfolio management principles.'
    vi.mocked(aiApi.aiChat).mockResolvedValue({
      reply: longReply,
      remainingMessages: 6,
    })

    render(<AIChatSidebar mode="anonymous" />)

    await userEvent.type(
      screen.getByPlaceholderText('Ask about any stock or market theme…'),
      'Tell me about investing'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    // Wait for at least some text to appear (animation has started)
    await screen.findByText(/This is a/, {}, { timeout: 5000 })

    // Capture the current text at this intermediate point
    let intermediateText = screen.getByText(/This is a/)?.textContent
    expect(intermediateText).toBeTruthy()
    expect(intermediateText?.length).toBeGreaterThan(5) // At least some chars revealed

    // Now type into the input while animation is still happening
    const inputField = screen.getByPlaceholderText('Ask about any stock or market theme…')
    await userEvent.type(inputField, 'extra text')

    // Wait a bit for animation to progress further
    await waitFor(() => {
      const currentText = screen.getByText(/This is a/)?.textContent
      // The text should have progressed (not restarted)
      // If it restarted, it would show much less text
      expect(currentText?.length).toBeGreaterThan(intermediateText?.length || 0)
    }, { timeout: 3000 })
  })

  it('does not restart typing animation in simulation mode when user types during response', async () => {
    const longReply = 'This is a longer simulation answer about portfolio construction, diversification, and risk-adjusted positioning.'
    vi.mocked(simulationApi.simulationChat).mockResolvedValue({
      kind: 'message',
      reply: longReply,
    })

    render(<AIChatSidebar mode="simulation" accountId="acct-1" />)

    await userEvent.type(
      screen.getByPlaceholderText('Ask about any stock or your portfolio…'),
      'Review my portfolio'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    await screen.findByText(/This is a/, {}, { timeout: 5000 })

    const intermediateText = screen.getByText(/This is a/)?.textContent
    expect(intermediateText).toBeTruthy()
    expect(intermediateText?.length).toBeGreaterThan(5)

    const inputField = screen.getByPlaceholderText('Ask about any stock or your portfolio…')
    await userEvent.type(inputField, ' more context')

    await waitFor(() => {
      const currentText = screen.getByText(/This is a/)?.textContent
      expect(currentText?.length).toBeGreaterThan(intermediateText?.length || 0)
    }, { timeout: 3000 })
  })

  it('preserves the authenticated chat draft while toggling desktop window modes', async () => {
    render(
      <AuthenticatedChatProvider>
        <AuthenticatedChatWindow />
      </AuthenticatedChatProvider>
    )

    const input = await screen.findByPlaceholderText('Ask about any stock or your portfolio…')
    await userEvent.type(input, 'Review my open positions')

    await userEvent.click(await screen.findByRole('button', { name: 'Expand chat to fullscreen' }))
    expect(screen.getByPlaceholderText('Ask about any stock or your portfolio…')).toHaveValue('Review my open positions')

    await userEvent.click(await screen.findByRole('button', { name: 'Collapse chat to launcher' }))
    expect(screen.getByRole('button', { name: 'Open AI assistant' })).toBeTruthy()

    await userEvent.click(await screen.findByRole('button', { name: 'Open AI assistant' }))
    expect(screen.getByPlaceholderText('Ask about any stock or your portfolio…')).toHaveValue('Review my open positions')

    await userEvent.click(await screen.findByRole('button', { name: 'Minimize chat to floating window' }))
    expect(screen.getByPlaceholderText('Ask about any stock or your portfolio…')).toHaveValue('Review my open positions')
  })

  it('forces fullscreen chat on mobile and hides desktop mode toggles', async () => {
    mockMatchMedia(true)

    render(
      <AuthenticatedChatProvider>
        <AuthenticatedChatWindow />
      </AuthenticatedChatProvider>
    )

    const input = await screen.findByPlaceholderText('Ask about any stock or your portfolio…')
    const wrapper = input.closest('aside')?.parentElement

    expect(wrapper).toHaveClass('inset-0')
    expect(screen.queryByRole('button', { name: 'Expand chat to fullscreen' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Minimize chat to floating window' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Collapse chat to launcher' })).toBeNull()
  })
})
