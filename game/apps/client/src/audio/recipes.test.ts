import { AUDIO, audioDef, listAudioIds } from '@wobblebeans/shared'
import { describe, expect, it } from 'vitest'
import { recipeFor, recipeLength, recipePeak } from './recipes'

describe('synth recipes', () => {
  it('covers every event id and keeps peaks and lengths inside the kid-safe cap', () => {
    for (const id of listAudioIds()) {
      const def = audioDef(id)
      const recipe = recipeFor(id)
      if (def.group === 'music') {
        expect(recipe, id).toBeNull()
        continue
      }
      expect(recipe, id).not.toBeNull()
      expect(recipePeak(recipe!), id).toBeLessThanOrEqual(0.708)
      const length = recipeLength(recipe!)
      if (def.stinger) expect(length, id).toBeLessThanOrEqual(4)
      else if (!recipe!.loop) expect(length, id).toBeLessThanOrEqual(3)
      for (const tone of recipe!.tones) {
        if (tone.wave !== 'noise') expect(tone.freq, id).toBeGreaterThanOrEqual(40)
      }
    }
  })

  it('makes GO louder than the count, and keeps rewards to a short major triad', () => {
    const go = recipeFor(AUDIO.countGo)!
    const three = recipeFor(AUDIO.count3)!
    expect(recipePeak(go)).toBeGreaterThan(recipePeak(three))
    const coins = recipeFor(AUDIO.rewardCoins)!
    expect(coins.tones).toHaveLength(3)
    expect(recipeLength(coins)).toBeLessThan(0.7)
    expect(recipeFor(AUDIO.uiPurchase)!.tones).toHaveLength(1)
  })

  it('rises through the great-try stinger', () => {
    const tones = [...recipeFor(AUDIO.greatTry)!.tones].sort((a, b) => a.at - b.at)
    for (let i = 1; i < tones.length; i++) {
      expect(tones[i]!.freq).toBeGreaterThanOrEqual(tones[i - 1]!.freq)
    }
  })

  it('keeps footsteps on the footstep group and gives the trick door two timbres', () => {
    expect(audioDef(AUDIO.footstepDefault).group).toBe('footstep')
    expect(recipeFor(AUDIO.trickdoor)!.alts).toHaveLength(2)
  })
})
