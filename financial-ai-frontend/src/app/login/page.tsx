'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '../../lib/authApi'
import { auth } from '../../lib/auth'
import { AIChatSidebar } from '../../components/chat/AIChatSidebar'

function getSafeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard'
  }

  return value
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [nextPath, setNextPath] = useState('/dashboard')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedMode = params.get('mode')

    if (requestedMode === 'register' || requestedMode === 'login') {
      setMode(requestedMode)
    }

    setNextPath(getSafeNextPath(params.get('next')))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'register') {
        await authApi.register(email, password)
      }
      const res = await authApi.login(email, password)
      auth.setTokens(res.accessToken, res.refreshToken)
      router.push(nextPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(242,225,188,0.75),_transparent_38%),linear-gradient(180deg,_#f7f1e4_0%,_#f4efe6_52%,_#ebe4d3_100%)] text-black">
      <div className="mx-auto grid min-h-screen w-full max-w-[1500px] gap-3 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] lg:gap-4 lg:px-8 lg:py-6">
        <div className="flex items-center justify-center rounded-2xl border border-black/10 bg-[#fffaf0]/90 px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.08)] lg:px-6 lg:py-6">
          <div className="w-full max-w-sm" id="auth-panel">

            {/* Branding */}
            <div className="mb-8 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-black/35">Financial AI</p>
              <h1 className="mb-1 mt-3 font-serif text-3xl text-black">Trade ideas with an AI copilot</h1>
              <p className="text-sm text-black/60">Trading Simulator</p>
            </div>

            {/* Login / Register toggle */}
            <div className="mb-6 flex overflow-hidden rounded-lg border border-black/20 bg-white/80 shadow-[0_12px_32px_rgba(0,0,0,0.04)]">
              {(['login', 'register'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError('') }}
                  className={`flex-1 py-2.5 text-sm font-bold uppercase tracking-wide transition-all ${
                    mode === m ? 'bg-black text-white' : 'bg-white text-black hover:bg-[#f6efdf]'
                  }`}
                >
                  {m === 'login' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wide mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="swiss-input w-full text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wide mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={mode === 'register' ? 8 : 1}
                  placeholder="••••••••"
                  className="swiss-input w-full text-sm"
                />
                {mode === 'register' && <p className="mt-1.5 text-xs text-black/40">Minimum 8 characters</p>}
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-900">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg border border-black bg-black py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-transparent hover:text-black disabled:opacity-50"
              >
                {loading ? 'Loading…' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-black/45">
              Anonymous chat is available on this page. Register when you want to continue past the free limit.
            </p>
          </div>
        </div>

        <div className="min-h-[620px] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
          <AIChatSidebar mode="anonymous" onUpgradeRequired={() => setMode('register')} />
        </div>
      </div>
    </div>
  )
}
