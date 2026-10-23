import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const audioDir = fileURLToPath(new URL('../../../../apps/client/src/audio/', import.meta.url))

describe('client audio sources', () => {
  it('has no microphone, speech synthesis, or sample files', () => {
    const files = readdirSync(audioDir).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    expect(files.length).toBeGreaterThan(5)
    const mic = ['getUser', 'Media'].join('')
    const speech = ['speech', 'Synthesis'].join('')
    const recognition = ['Speech', 'Recognition'].join('')
    for (const name of files) {
      const text = readFileSync(join(audioDir, name), 'utf8')
      expect(text.includes(mic), name).toBe(false)
      expect(text.includes(speech), name).toBe(false)
      expect(text.includes(recognition), name).toBe(false)
      for (const ext of ['mp3', 'ogg', 'wav']) {
        expect(text.includes(`.${ext}'`) || text.includes(`.${ext}"`), name).toBe(false)
      }
    }
  })
})
