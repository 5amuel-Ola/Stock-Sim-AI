import OpenAI from 'openai'
import { config } from '../lib/config'
import { AppError } from '../lib/errors'
import { logger } from '../lib/logger'
import type { AiProvider, ChatMessage } from './ai.provider'

export function createOpenAiProvider(client = new OpenAI({ apiKey: config.OPENAI_API_KEY })): AiProvider {
  return {
    async chat(messages: ChatMessage[]): Promise<string> {
      const start = Date.now()
      try {
        const completion = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
        })
        logger.debug('OpenAI chat call', { ms: Date.now() - start, turns: messages.length })
        return completion.choices[0].message.content ?? ''
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : String(err)
        logger.error('OpenAI chat error', { message: errMessage })
        throw new AppError('AI service unavailable', 502, 'AI_ERROR')
      }
    },

    async structuredJson<T>(messages: ChatMessage[]): Promise<T> {
      const start = Date.now()
      try {
        const completion = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages,
        })
        logger.debug('OpenAI agent call', { ms: Date.now() - start })
        const text = completion.choices[0].message.content ?? '{}'
        return JSON.parse(text) as T
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : String(err)
        logger.error('OpenAI agent error', { message: errMessage })
        throw new AppError('AI agent unavailable', 502, 'AI_ERROR')
      }
    },
  }
}

export const openAiProvider = createOpenAiProvider()