'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AIChatSidebar } from '../components/chat/AIChatSidebar'
import { auth } from '../lib/auth'

const STARTER_QUESTIONS = [
  'What are the biggest risks in a portfolio that is heavy on NVDA and TSLA?',
  'If I had $10,000 to split between stocks and crypto, how would you structure it?',
  'What should I watch before buying AAPL after earnings?',
]

const FEATURE_CARDS = [
  {
    eyebrow: 'AI Guidance',
    title: 'Ask the market chatbot anything',
    description: 'Get stock, crypto, and market-theme answers before you commit to a trade.',
    target: '/dashboard',
  },
  {
    eyebrow: 'Trading Simulator',
    title: 'Practice buys, sells, and limit orders',
    description: 'Test ideas with a paper portfolio, balances, and transaction history.',
    target: '/dashboard',
  },
  {
    eyebrow: 'Portfolio Insight',
    title: 'Review risk, trends, and suggestions',
    description: 'See how concentrated your portfolio is and where the main exposure sits.',
    target: '/dashboard',
  },
]

export default function Home() {
  const router = useRouter()
  const chatPanelRef = useRef<HTMLDivElement>(null)
  const featuresRef = useRef<HTMLElement>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [starterPrompt, setStarterPrompt] = useState<{ id: number; text: string } | null>(null)
  const [showFeatures, setShowFeatures] = useState(false)
  const [chatState, setChatState] = useState<{ remainingMessages: number | null; loading: boolean }>({
    remainingMessages: 7,
    loading: false,
  })

  useEffect(() => {
    setIsLoggedIn(auth.isLoggedIn())
  }, [])

  function toggleFeatures() {
    setShowFeatures(prev => !prev)
    if (!showFeatures) {
      setTimeout(() => {
        featuresRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 0)
    }
  }

  function handleStarterQuestion(text: string) {
    setStarterPrompt(prev => ({ id: (prev?.id ?? 0) + 1, text }))
    chatPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleFeatureSelect(target: string) {
    if (isLoggedIn) {
      router.push(target)
      return
    }

    const params = new URLSearchParams({ next: target, mode: 'register' })
    router.push(`/login?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(242,225,188,0.75),_transparent_38%),linear-gradient(180deg,_#f7f1e4_0%,_#f4efe6_52%,_#ebe4d3_100%)] text-black">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <header className="mb-3 flex items-center justify-between border border-black/10 bg-white/80 px-3 py-2 backdrop-blur sm:px-4 sm:py-2.5 rounded-lg">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-black/35">Financial AI</p>
            <h1 className="mt-0.5 font-serif text-lg text-black sm:text-xl">Trade ideas with an AI copilot</h1>
          </div>
          <button
            type="button"
            onClick={() => router.push(isLoggedIn ? '/dashboard' : '/login')}
            className="border border-black bg-black px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-transparent hover:text-black"
          >
            {isLoggedIn ? 'Open Dashboard' : 'Sign In / Log In'}
          </button>
        </header>

        <main className="grid flex-1 gap-3 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)] lg:gap-4">
          <section className="flex flex-col justify-between border border-black/10 bg-[#fffaf0]/90 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.08)] sm:p-5 rounded-2xl">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-black/45">Home</p>
              <h2 className="mt-3 max-w-[12ch] font-serif text-2xl leading-tight sm:text-3xl">
                Chat first. Explore the platform when you are ready.
              </h2>
              <p className="mt-2 max-w-xl text-xs leading-5 text-black/70 sm:text-sm">
                The homepage stays focused on the AI chat and a fast introduction. Ask a question, then review the product features when you want the full simulator experience.
              </p>

              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/45">Starter Questions</p>
                  <p className="text-[10px] font-semibold text-black/40">{chatState.remainingMessages ?? 7} left</p>
                </div>
                {STARTER_QUESTIONS.map(question => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => handleStarterQuestion(question)}
                    disabled={chatState.remainingMessages === 0 || chatState.loading}
                    className="group flex w-full items-start justify-between gap-3 border border-black/10 bg-white px-3 py-2.5 text-left transition-transform transition-colors hover:-translate-y-0.5 hover:border-black hover:bg-[#f6efdf] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-black/10 disabled:hover:bg-white"
                  >
                    <span className="text-xs leading-4 text-black/80">{question}</span>
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-black/35 transition-colors group-hover:text-black">
                      Ask
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={toggleFeatures}
                className="border border-black px-3 py-2 text-xs font-semibold text-black transition-colors hover:bg-black hover:text-white rounded-lg"
              >
                {showFeatures ? 'Hide Features' : 'See Features'}
              </button>
              <p className="max-w-sm text-[11px] leading-4 text-black/55 sm:text-xs">
                Selecting a feature takes users through sign up or log in before opening the simulator.
              </p>
            </div>
          </section>

          <div
            ref={chatPanelRef}
            className="h-[620px] overflow-hidden border border-black/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.08)] rounded-2xl"
          >
            <AIChatSidebar
              mode="anonymous"
              onUpgradeRequired={() => router.push('/login?mode=register&next=/dashboard')}
              starterPrompt={starterPrompt}
              onStateChange={setChatState}
            />
          </div>
        </main>

        <section
          id="features"
          ref={featuresRef}
          className={`mt-3 border border-black/10 bg-white/85 p-4 backdrop-blur sm:mt-5 sm:p-6 rounded-2xl transition-all duration-300 overflow-hidden ${
            showFeatures ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/40">What You Can Do</p>
              <h3 className="mt-2 font-serif text-xl sm:text-2xl text-black">Move from conversation to simulation</h3>
            </div>
            <p className="max-w-2xl text-xs leading-5 text-black/65 sm:text-sm">
              These are the authenticated parts of the product. Open any one of them and the app will ask the user to register or sign in first.
            </p>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {FEATURE_CARDS.map(feature => (
              <button
                key={feature.title}
                type="button"
                onClick={() => handleFeatureSelect(feature.target)}
                className="flex h-full flex-col justify-between border border-black/10 bg-[#fbf7ee] p-4 text-left transition-transform transition-colors hover:-translate-y-0.5 hover:border-black hover:bg-[#f3ead6] rounded-xl"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-black/40">{feature.eyebrow}</p>
                  <h4 className="mt-2 text-sm font-semibold text-black">{feature.title}</h4>
                  <p className="mt-2 text-xs leading-4 text-black/65">{feature.description}</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-black/10 pt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-black/45">
                  <span>{isLoggedIn ? 'Open' : 'Sign In Required'}</span>
                  <span>View</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
