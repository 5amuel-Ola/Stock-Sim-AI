import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf-8')
}

function readDirectory(relativePath: string): string[] {
  return readdirSync(join(process.cwd(), relativePath))
}

describe('Architecture boundaries', () => {
  it('keeps market orchestration on the provider registry instead of upstream clients', () => {
    const marketService = readSource('src/market/market.service.ts')

    expect(marketService).toContain("createMarketProviderRegistry")
    expect(marketService).not.toContain('alpacaClient')
    expect(marketService).not.toContain('geminiClient')
    expect(marketService).not.toContain('yahooClient')
  })

  it('keeps market clients behind the provider adapter module', () => {
    const marketProviders = readSource('src/market/market.providers.ts')

    expect(marketProviders).toContain("from './alpaca.client'")
    expect(marketProviders).toContain("from './gemini.client'")
    expect(marketProviders).toContain("from './yahoo.client'")

    for (const routerFile of ['src/market/market.router.ts', 'src/simulation/simulation.router.ts']) {
      const source = readSource(routerFile)
      expect(source).not.toContain('alpaca.client')
      expect(source).not.toContain('gemini.client')
      expect(source).not.toContain('yahoo.client')
    }
  })

  it('keeps AI service on provider abstractions rather than SDK constructors', () => {
    const aiService = readSource('src/ai/ai.service.ts')

    expect(aiService).toContain('createAiProviderFactory')
    expect(aiService).not.toContain("from 'openai'")
    expect(aiService).not.toContain('@google/generative-ai')
  })

  it('limits direct AI SDK imports to provider adapters', () => {
    const aiFiles = readDirectory('src/ai').filter((file) => file.endsWith('.ts'))

    for (const file of aiFiles) {
      const source = readSource(`src/ai/${file}`)
      if (file === 'openai.provider.ts') {
        expect(source).toContain("from 'openai'")
        continue
      }

      if (file === 'gemini.provider.ts') {
        expect(source).toContain('@google/generative-ai')
        continue
      }

      expect(source).not.toContain("from 'openai'")
      expect(source).not.toContain('@google/generative-ai')
    }
  })
})