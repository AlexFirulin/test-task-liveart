import { describe, expect, it } from 'vitest'
import type { OperationsInput } from '../../src/types/operations'
import { defaultAdjustments } from '../../src/utils/filters'
import { fromOperations, parseOperationsFile, toOperations } from '../../src/utils/operations'
import { defaultTransform } from '../../src/utils/transform'

const neutralInput: OperationsInput = {
  transform: defaultTransform,
  crop: null,
  adjustments: defaultAdjustments,
  filter: null,
}

describe('toOperations', () => {
  it('omits every slot when everything is neutral', () => {
    expect(toOperations(neutralInput)).toEqual([])
  })

  it('includes only the non-neutral slots, in pipeline order', () => {
    const operations = toOperations({
      transform: { rotate: 90, flipX: true, flipY: false },
      crop: { left: 1, top: 2, width: 10, height: 20 },
      adjustments: { brightness: 120, contrast: 100, saturation: 100 },
      filter: 'sepia',
    })

    expect(operations).toEqual([
      { type: 'transform', rotate: 90, flipX: true, flipY: false },
      { type: 'crop', left: 1, top: 2, width: 10, height: 20 },
      { type: 'adjust', brightness: 120, contrast: 100, saturation: 100 },
      { type: 'filter', name: 'sepia' },
    ])
  })

  it('drops a neutral transform even when other slots are set', () => {
    const operations = toOperations({
      ...neutralInput,
      filter: 'greyscale',
    })
    expect(operations).toEqual([{ type: 'filter', name: 'greyscale' }])
  })
})

describe('fromOperations', () => {
  it('falls back to neutral defaults for slots with no operation', () => {
    expect(fromOperations([])).toEqual(neutralInput)
  })

  it('is the inverse of toOperations for a full set of operations', () => {
    const input: OperationsInput = {
      transform: { rotate: 180, flipX: false, flipY: true },
      crop: { left: 5, top: 5, width: 50, height: 40 },
      adjustments: { brightness: 80, contrast: 110, saturation: 90 },
      filter: 'warm',
    }
    expect(fromOperations(toOperations(input))).toEqual(input)
  })

  it('last operation of a given type wins if duplicates are passed directly', () => {
    const result = fromOperations([
      { type: 'filter', name: 'sepia' },
      { type: 'filter', name: 'invert' },
    ])
    expect(result.filter).toBe('invert')
  })
})

describe('parseOperationsFile', () => {
  it('round-trips a canonical operations file back to the same input', () => {
    const input: OperationsInput = {
      transform: { rotate: 270, flipX: true, flipY: true },
      crop: { left: 0, top: 0, width: 100, height: 100 },
      adjustments: { brightness: 105, contrast: 95, saturation: 100 },
      filter: 'cool',
    }
    const json = JSON.stringify({ version: 1, operations: toOperations(input) })
    expect(parseOperationsFile(json)).toEqual(input)
  })

  it('rejects invalid JSON', () => {
    expect(() => parseOperationsFile('{not json')).toThrow(/not valid JSON/)
  })

  it('rejects an unsupported version', () => {
    const json = JSON.stringify({ version: 2, operations: [] })
    expect(() => parseOperationsFile(json)).toThrow(/unsupported version/)
  })

  it('rejects a missing operations array', () => {
    const json = JSON.stringify({ version: 1 })
    expect(() => parseOperationsFile(json)).toThrow(/must be an array/)
  })

  it('rejects an unknown operation type', () => {
    const json = JSON.stringify({ version: 1, operations: [{ type: 'blur' }] })
    expect(() => parseOperationsFile(json)).toThrow(/unknown type/)
  })

  it('rejects a rotate value that is not a right angle', () => {
    const json = JSON.stringify({
      version: 1,
      operations: [{ type: 'transform', rotate: 45, flipX: false, flipY: false }],
    })
    expect(() => parseOperationsFile(json)).toThrow(/rotate/)
  })

  it('rejects a duplicate operation type', () => {
    const json = JSON.stringify({
      version: 1,
      operations: [
        { type: 'filter', name: 'sepia' },
        { type: 'filter', name: 'warm' },
      ],
    })
    expect(() => parseOperationsFile(json)).toThrow(/duplicate/)
  })

  it('rejects operations out of canonical pipeline order', () => {
    const json = JSON.stringify({
      version: 1,
      operations: [
        { type: 'crop', left: 0, top: 0, width: 10, height: 10 },
        { type: 'transform', rotate: 90, flipX: false, flipY: false },
      ],
    })
    expect(() => parseOperationsFile(json)).toThrow(/canonical order/)
  })
})
