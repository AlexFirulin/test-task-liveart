import { describe, expect, it } from 'vitest'
import {
  defaultTransform,
  isNeutralTransform,
  normalizeRotation,
  rotatedDimensions,
} from '../../src/utils/transform'

describe('isNeutralTransform', () => {
  it('is neutral for the default transform', () => {
    expect(isNeutralTransform(defaultTransform)).toBe(true)
  })

  it('is not neutral when rotated', () => {
    expect(isNeutralTransform({ rotate: 90, flipX: false, flipY: false })).toBe(false)
  })

  it('is not neutral when flipped on either axis', () => {
    expect(isNeutralTransform({ rotate: 0, flipX: true, flipY: false })).toBe(false)
    expect(isNeutralTransform({ rotate: 0, flipX: false, flipY: true })).toBe(false)
  })
})

describe('normalizeRotation', () => {
  it('passes through exact right angles', () => {
    expect(normalizeRotation(0)).toBe(0)
    expect(normalizeRotation(90)).toBe(90)
    expect(normalizeRotation(180)).toBe(180)
    expect(normalizeRotation(270)).toBe(270)
  })

  it('folds negative angles into 0-359', () => {
    expect(normalizeRotation(-90)).toBe(270)
    expect(normalizeRotation(-360)).toBe(0)
  })

  it('folds angles beyond 360 back into range', () => {
    expect(normalizeRotation(360)).toBe(0)
    expect(normalizeRotation(450)).toBe(90)
    expect(normalizeRotation(990)).toBe(270)
  })

  it('rounds float drift from repeated increments to the nearest right angle', () => {
    expect(normalizeRotation(89.6)).toBe(90)
    expect(normalizeRotation(-1)).toBe(0)
    expect(normalizeRotation(179.4)).toBe(180)
  })
})

describe('rotatedDimensions', () => {
  it('keeps dimensions for 0 and 180', () => {
    expect(rotatedDimensions(0, 400, 300)).toEqual({ width: 400, height: 300 })
    expect(rotatedDimensions(180, 400, 300)).toEqual({ width: 400, height: 300 })
  })

  it('swaps dimensions for 90 and 270', () => {
    expect(rotatedDimensions(90, 400, 300)).toEqual({ width: 300, height: 400 })
    expect(rotatedDimensions(270, 400, 300)).toEqual({ width: 300, height: 400 })
  })
})
