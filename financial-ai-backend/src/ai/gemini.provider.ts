import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from '../lib/config'
import { AppError } from '../lib/errors'
import { logger } from '../lib/logger'
import type { AiProvider, ChatMessage } from './ai.provider'

interface GeminiTextResponse {
  text(): string
}

interface GeminiGenerationResult {
  response: GeminiTextResponse
}

interface GeminiModel {
  generateContent(prompt: string): Promise<GeminiGenerationResult>
}

interface GeminiClient {
  getGenerativeModel(options: { model: string }): GeminiModel
}

const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash'

function renderGeminiPrompt(messages: ChatMessage[]): string {
  const renderedMessages = messages.map(message => {
    if (message.role === 'system') {
      return `SYSTEM INSTRUCTIONS:\n${message.content}`
    }

    if (message.role === 'assistant') {
      return `ASSISTANT:\n${message.content}`
    }

    return `USER:\n${message.content}`
  })

  return `${renderedMessages.join('\n\n')}\n\nASSISTANT:`
}

function unwrapJson(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  }
  return trimmed
}

export function createGeminiProvider(
  client: GeminiClient = new GoogleGenerativeAI(config.GOOGLE_GEMINI_API_KEY),
  modelName = DEFAULT_GEMINI_MODEL,
): AiProvider {
  const model = client.getGenerativeModel({ model: modelName })

  return {
    async chat(messages: ChatMessage[]): Promise<string> {
      const start = Date.now()
      try {
        const completion = await model.generateContent(renderGeminiPrompt(messages))
        logger.debug('Gemini chat call', { ms: Date.now() - start, turns: messages.length })
        return completion.response.text()
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : String(err)
        logger.error('Gemini chat error', { message: errMessage })
        throw new AppError('AI service unavailable', 502, 'AI_ERROR')
      }
    },

    async structuredJson<T>(messages: ChatMessage[]): Promise<T> {
      const start = Date.now()
      try {
        const completion = await model.generateContent(renderGeminiPrompt(messages))
        logger.debug('Gemini agent call', { ms: Date.now() - start, turns: messages.length })
        return JSON.parse(unwrapJson(completion.response.text())) as T
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : String(err)
        logger.error('Gemini agent error', { message: errMessage })
        throw new AppError('AI agent unavailable', 502, 'AI_ERROR')
      }
    },
  }
}

export const geminiProvider = createGeminiProvider()