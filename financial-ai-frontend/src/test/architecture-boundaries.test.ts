import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf-8')
}

function listProductionFiles(relativePath: string): string[] {
  const basePath = join(process.cwd(), relativePath)
  const results: string[] = []

  for (const entry of readdirSync(basePath)) {
    const fullPath = join(basePath, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      results.push(...listProductionFiles(relative(join(process.cwd()), fullPath)))
      continue
    }

    if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue
    if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) continue
    if (entry === 'setup.ts') continue

    results.push(relative(process.cwd(), fullPath).replace(/\\/g, '/'))
  }

  return results
}

describe('Architecture boundaries', () => {
  it('keeps transport details behind lib/apiTransport.ts', () => {
    const productionFiles = listProductionFiles('src')

    for (const file of productionFiles) {
      const source = readSource(file)
      if (file === 'src/lib/apiTransport.ts') {
        expect(source).toContain('httpClient')
        continue
      }

      expect(source).not.toMatch(/import\s+\{[^}]*\bhttpClient\b[^}]*\}\s+from\s+['"].*httpClient['"]/)
    }
  })

  it('keeps request transport imports inside the domain API layer', () => {
    const transportConsumers = [
      'src/lib/aiApi.ts',
      'src/lib/authApi.ts',
      'src/lib/marketApi.ts',
      'src/lib/portfolioApi.ts',
      'src/lib/simulationApi.ts',
    ]

    for (const file of transportConsumers) {
      const source = readSource(file)
      expect(source).toContain('apiTransport')
    }

    for (const file of listProductionFiles('src')) {
      if (file.startsWith('src/lib/')) continue
      const source = readSource(file)
      expect(source).not.toContain('apiTransport')
    }
  })

  it('keeps anonymous chat session state inside aiApi', () => {
    const productionFiles = listProductionFiles('src')

    for (const file of productionFiles) {
      const source = readSource(file)
      if (file === 'src/lib/aiApi.ts' || file === 'src/lib/chatSession.ts') {
        expect(source).toContain('chatSession')
        continue
      }

      expect(source).not.toContain('chatSession')
    }
  })
})