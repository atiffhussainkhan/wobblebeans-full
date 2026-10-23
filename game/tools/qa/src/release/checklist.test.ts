import { describe, expect, it } from 'vitest'
import { bundleBudgetResult, runChecklist } from './checklist'

describe('release checklist', () => {
  it('matches protocol, physics, manifest, licences, safety flags, and secrets', () => {
    const results = runChecklist()
    const failed = results.filter((result) => !result.ok)
    expect(failed, results.map((result) => `${result.ok ? 'ok' : 'FAIL'} ${result.name}: ${result.detail}`).join('\n')).toEqual([])
  })

  it('keeps the client bundle under the gzip budget with no secrets', () => {
    const result = bundleBudgetResult()
    expect(result.ok, result.detail).toBe(true)
  }, 120_000)
})
