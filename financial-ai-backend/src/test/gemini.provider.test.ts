import { describe, expect, it, vi } from 'vitest'
import { createGeminiProvider } from '../ai/gemini.provider'

describe('createGeminiProvider', () => {
  it('renders multi-turn chat messages into a Gemini prompt', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      response: { text: () => 'Gemini reply' },
    })
    const provider = createGeminiProvider({
      getGenerativeModel: vi.fn().mockReturnValue({ generateContent }),
    })

    const reply = await provider.chat([
      { role: 'system', content: 'Be concise' },
      { role: 'assistant', content: 'Previous answer' },
      { role: 'user', content: 'What next?' },
    ])

    expect(reply).toBe('Gemini reply')
    expect(generateContent).toHaveBeenCalledWith(expect.stringContaining('SYSTEM INSTRUCTIONS:\nBe concise'))
    expect(generateContent).toHaveBeenCalledWith(expect.stringContaining('ASSISTANT:\nPrevious answer'))
    expect(generateContent).toHaveBeenCalledWith(expect.stringContaining('USER:\nWhat next?'))
  })

  it('parses fenced JSON responses for structured output', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      response: { text: () => '```json\n{"answer":"ok"}\n```' },
    })
    const provider = createGeminiProvider({
      getGenerativeModel: vi.fn().mockReturnValue({ generateContent }),
    })

    await expect(provider.structuredJson<{ answer: string }>([
      { role: 'system', content: 'Return JSON only' },
      { role: 'user', content: 'hello' },
    ])).resolves.toEqual({ answer: 'ok' })
  })
})