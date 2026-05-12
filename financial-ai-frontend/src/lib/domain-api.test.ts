import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./auth', () => ({
  auth: {
    getAccessToken: vi.fn(() => null),
    clear: vi.fn(),
  },
}))

import { auth } from './auth'
import { aiApi } from './aiApi'
import { chatSession } from './chatSession'
import { anonymousRuntime } from './anonymousRuntime'
import { simulationApi } from './simulationApi'

function createLocalStorageMock() {
  let store = new Map<string, string>()

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
    clear: vi.fn(() => {
      store = new Map<string, string>()
    }),
  }
}

describe('aiApi.aiChat', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    anonymousRuntime.reset()

    const localStorageMock = createLocalStorageMock()
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    })

    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: localStorageMock, location: { href: '' } },
      configurable: true,
    })
  })

  it('sends the stored sessionId and persists the sessionId returned by the backend', async () => {
    anonymousRuntime.setSessionId('existing-session')

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        reply: 'Hello',
        sessionId: 'server-session',
        isAnonymous: true,
        messageCount: 2,
        remainingMessages: 5,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await aiApi.aiChat('hello')

    expect(result.reply).toBe('Hello')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/ai/chat',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-session-id': 'existing-session',
        }),
      }),
    )
    expect(chatSession.getSessionId()).toBe('server-session')
  })

  it('persists the returned sessionId from an upgrade-required response before rethrowing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: 'Anonymous chat limit reached. Sign up to continue.',
        code: 'UPGRADE_REQUIRED',
        sessionId: 'upgrade-session',
        messageCount: 8,
        remainingMessages: 0,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(aiApi.aiChat('hello')).rejects.toMatchObject({
      status: 403,
      code: 'UPGRADE_REQUIRED',
    })

    expect(chatSession.getSessionId()).toBe('upgrade-session')
  })
})

describe('simulationApi.simulationChat', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    anonymousRuntime.reset()

    const localStorageMock = createLocalStorageMock()
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    })

    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: localStorageMock, location: { href: '' } },
      configurable: true,
    })
  })

  it('uses the authenticated simulation route and does not send x-session-id headers', async () => {
    vi.mocked(auth.getAccessToken).mockReturnValue('access-123')
    anonymousRuntime.setSessionId('anon-session-should-not-be-used')

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ reply: 'Simulation reply' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await simulationApi.simulationChat('acct-1', 'hello', [
      { role: 'user', content: 'previous' },
    ])

    expect(result.reply).toBe('Simulation reply')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/simulation/accounts/acct-1/ai/chat',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer access-123',
        }),
      }),
    )

    const requestOptions = fetchMock.mock.calls[0][1] as { headers: Record<string, string> }
    expect(requestOptions.headers['x-session-id']).toBeUndefined()
  })
})
