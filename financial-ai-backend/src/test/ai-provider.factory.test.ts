import { describe, expect, it, vi } from 'vitest'
import type { AiProvider } from '../ai/ai.provider'
import { createAiProviderFactory, createFallbackAiProvider } from '../ai/ai-provider.factory'
import { AppError } from '../lib/errors'

function createStubProvider(): AiProvider {
  return {
    chat: vi.fn(),
    structuredJson: vi.fn(),
  }
}

describe('ai provider factory', () => {
  it('returns the requested provider from the registry', () => {
    const openai = createStubProvider()
    const gemini = createStubProvider()
    const factory = createAiProviderFactory({ openai, gemini })

    expect(factory.createProvider('openai')).toBe(openai)
    expect(factory.createProvider('gemini')).toBe(gemini)
  })

  it('returns the primary provider when no fallback is requested', () => {
    const openai = createStubProvider()
    const gemini = createStubProvider()
    const factory = createAiProviderFactory({ openai, gemini })

    expect(factory.createProviderWithFallback('openai')).toBe(openai)
    expect(factory.createProviderWithFallback('openai', 'openai')).toBe(openai)
  })

  it('falls back on chat when the primary provider fails', async () => {
    const primary = createStubProvider()
    const fallback = createStubProvider()
    vi.mocked(primary.chat).mockRejectedValue(new AppError('primary down', 502, 'AI_ERROR'))
    vi.mocked(fallback.chat).mockResolvedValue('fallback reply')

    const provider = createFallbackAiProvider(primary, fallback)

    await expect(provider.chat([{ role: 'user', content: 'hello' }])).resolves.toBe('fallback reply')
    expect(primary.chat).toHaveBeenCalledTimes(1)
    expect(fallback.chat).toHaveBeenCalledTimes(1)
  })

  it('falls back on structuredJson when the primary provider fails', async () => {
    const primary = createStubProvider()
    const fallback = createStubProvider()
    vi.mocked(primary.structuredJson).mockRejectedValue(new AppError('primary down', 502, 'AI_ERROR'))
    vi.mocked(fallback.structuredJson).mockResolvedValue({ ok: true })

    const provider = createFallbackAiProvider(primary, fallback)

    await expect(provider.structuredJson<{ ok: boolean }>([{ role: 'user', content: 'hello' }])).resolves.toEqual({ ok: true })
    expect(primary.structuredJson).toHaveBeenCalledTimes(1)
    expect(fallback.structuredJson).toHaveBeenCalledTimes(1)
  })
})