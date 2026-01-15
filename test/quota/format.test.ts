/**
 * Tests for quota formatting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { printQuotaTable, printQuotaJson } from '../../src/quota/format.js'
import type { QuotaSnapshot } from '../../src/quota/types.js'

describe('printQuotaJson', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('should output valid JSON', () => {
    const snapshot: QuotaSnapshot = {
      timestamp: '2026-01-14T12:00:00.000Z',
      method: 'google',
      models: []
    }

    printQuotaJson(snapshot)

    expect(consoleSpy).toHaveBeenCalledOnce()
    const output = consoleSpy.mock.calls[0][0]
    const parsed = JSON.parse(output as string)
    expect(parsed.method).toBe('google')
  })
})

describe('printQuotaTable', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('should output table format', () => {
    const snapshot: QuotaSnapshot = {
      timestamp: '2026-01-14T12:00:00.000Z',
      method: 'google',
      promptCredits: {
        available: 450,
        monthly: 500,
        usedPercentage: 0.1,
        remainingPercentage: 0.9
      },
      models: [
        {
          label: 'Test Model',
          modelId: 'test-model',
          remainingPercentage: 0.85,
          isExhausted: false,
          timeUntilResetMs: 3600000
        }
      ]
    }

    printQuotaTable(snapshot)

    // Verify console was called multiple times (header, table)
    expect(consoleSpy.mock.calls.length).toBeGreaterThan(2)
    
    // Check that some expected content is in the output
    const allOutput = consoleSpy.mock.calls.map(c => c[0]).join('\n')
    expect(allOutput).toContain('Antigravity')
    expect(allOutput).toContain('Test Model')
    expect(allOutput).toContain('85%')
  })

  it('should handle exhausted models', () => {
    const snapshot: QuotaSnapshot = {
      timestamp: '2026-01-14T12:00:00.000Z',
      method: 'google',
      models: [
        {
          label: 'Exhausted Model',
          modelId: 'exhausted',
          isExhausted: true
        }
      ]
    }

    printQuotaTable(snapshot)

    const allOutput = consoleSpy.mock.calls.map(c => c[0]).join('\n')
    expect(allOutput).toContain('EXHAUSTED')
  })
})
