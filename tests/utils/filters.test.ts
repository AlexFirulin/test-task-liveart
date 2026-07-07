import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyAdjustmentsToPixels,
  defaultAdjustments,
  isNeutralAdjustments,
  toCssFilter,
} from '../../src/utils/filters'

describe('isNeutralAdjustments', () => {
  it('is neutral for the default adjustments', () => {
    expect(isNeutralAdjustments(defaultAdjustments)).toBe(true)
  })

  it('is not neutral when any channel deviates', () => {
    expect(isNeutralAdjustments({ ...defaultAdjustments, brightness: 120 })).toBe(false)
    expect(isNeutralAdjustments({ ...defaultAdjustments, contrast: 80 })).toBe(false)
    expect(isNeutralAdjustments({ ...defaultAdjustments, saturation: 0 })).toBe(false)
  })
})

describe('toCssFilter', () => {
  it('builds brightness/contrast/saturate with no filter', () => {
    expect(toCssFilter(defaultAdjustments, null)).toBe(
      'brightness(100%) contrast(100%) saturate(100%)',
    )
  })

  it('reflects custom adjustment values', () => {
    expect(toCssFilter({ brightness: 120, contrast: 90, saturation: 50 }, null)).toBe(
      'brightness(120%) contrast(90%) saturate(50%)',
    )
  })

  it('appends the named filter after the adjustments', () => {
    expect(toCssFilter(defaultAdjustments, 'greyscale')).toBe(
      'brightness(100%) contrast(100%) saturate(100%) grayscale(1)',
    )
    expect(toCssFilter(defaultAdjustments, 'sepia')).toBe(
      'brightness(100%) contrast(100%) saturate(100%) sepia(1)',
    )
  })
})

describe('applyAdjustmentsToPixels', () => {
  it('leaves pixel data unchanged for neutral adjustments and no filter', async () => {
    const data = new Uint8ClampedArray([10, 20, 30, 255, 200, 150, 100, 255])
    const before = Uint8ClampedArray.from(data)
    await applyAdjustmentsToPixels(data, 2, defaultAdjustments, null)
    expect(Array.from(data)).toEqual(Array.from(before))
  })

  it('scales and clamps brightness', async () => {
    const data = new Uint8ClampedArray([200, 100, 50, 255])
    await applyAdjustmentsToPixels(data, 1, { ...defaultAdjustments, brightness: 200 }, null)
    // 200*2 clamps to 255, 100*2 = 200, 50*2 = 100
    expect(Array.from(data.slice(0, 3))).toEqual([255, 200, 100])
    expect(data[3]).toBe(255) // alpha untouched
  })

  it('converts to greyscale using the luma weights', async () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255])
    await applyAdjustmentsToPixels(data, 1, defaultAdjustments, 'greyscale')
    const expectedGray = Math.round(0.2126 * 255)
    expect(data[0]).toBe(expectedGray)
    expect(data[1]).toBe(expectedGray)
    expect(data[2]).toBe(expectedGray)
  })

  describe('chunked processing for large canvases', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'requestAnimationFrame',
        (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number,
      )
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('does not yield to rAF for a canvas at or under the chunking threshold', async () => {
      const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame')
      const data = new Uint8ClampedArray(4 * 4) // tiny canvas, well under the threshold
      await applyAdjustmentsToPixels(data, 4, defaultAdjustments, null)
      expect(rafSpy).not.toHaveBeenCalled()
    })

    it('processes every pixel across chunk boundaries for a canvas above the threshold', async () => {
      const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame')
      const width = 2000
      const height = 2001 // 4,002,000 px > the 4,000,000px chunking threshold
      const data = new Uint8ClampedArray(width * height * 4)
      data.fill(200) // brightness(200%) alone would clamp this to 255 everywhere

      await applyAdjustmentsToPixels(data, width, { ...defaultAdjustments, brightness: 200 }, null)

      // rAF must have been used at least once (chunked), and more than once
      // proves it actually crossed a chunk boundary rather than doing it all
      // in a single yield.
      expect(rafSpy.mock.calls.length).toBeGreaterThan(1)

      // First pixel (first chunk) and last pixel (last chunk) must both have
      // been processed, confirming the whole array was covered.
      expect(data[0]).toBe(255)
      const lastPixelStart = data.length - 4
      expect(data[lastPixelStart]).toBe(255)
    })
  })
})
