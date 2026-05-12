import { logger } from '../lib/logger'
import type { AiProvider, ChatMessage } from './ai.provider'
import { geminiProvider } from './gemini.provider'
import { openAiProvider } from './openai.provider'

export type AiProviderName = 'openai' | 'gemini'

type ProviderRegistry = Record<AiProviderName, AiProvider>

export interface AiProviderFactory {
  createProvider(name: AiProviderName): AiProvider
  createProviderWithFallback(primary: AiProviderName, fallback?: AiProviderName): AiProvider
}

const defaultProviderRegistry: ProviderRegistry = {
  openai: openAiProvider,
  gemini: geminiProvider,
}

export function createFallbackAiProvider(primary: AiProvider, fallback: AiProvider): AiProvider {
  async function withFallback<T>(
    operationName: 'chat' | 'structuredJson',
    operation: (provider: AiProvider) => Promise<T>,
  ): Promise<T> {
    try {
      return await operation(primary)
    } catch (primaryError: unknown) {
      logger.warn('Primary AI provider failed, trying fallback', { operationName })

      try {
        return await operation(fallback)
      } catch (fallbackError: unknown) {
        logger.error('Fallback AI provider failed', {
          operationName,
          primaryError: primaryError instanceof Error ? primaryError.message : String(primaryError),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        })
        throw fallbackError
      }
    }
  }

  return {
    chat(messages: ChatMessage[]) {
      return withFallback('chat', provider => provider.chat(messages))
    },

    structuredJson<T>(messages: ChatMessage[]) {
      return withFallback('structuredJson', provider => provider.structuredJson<T>(messages))
    },
  }
}

export function createAiProviderFactory(registry: ProviderRegistry = defaultProviderRegistry): AiProviderFactory {
  return {
    createProvider(name: AiProviderName): AiProvider {
      return registry[name]
    },

    createProviderWithFallback(primary: AiProviderName, fallback?: AiProviderName): AiProvider {
      const primaryProvider = registry[primary]
      if (!fallback || fallback === primary) {
        return primaryProvider
      }

      return createFallbackAiProvider(primaryProvider, registry[fallback])
    },
  }
}