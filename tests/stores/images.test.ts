import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAdjustments } from '../../src/utils/filters'
import { defaultTransform } from '../../src/utils/transform'
import { useImagesStore } from '../../src/stores/images'

function makeFile(name = 'photo.png'): File {
  return new File(['fake-bytes'], name, { type: 'image/png' })
}

// Node's real URL.createObjectURL registers Blobs in a registry that can be
// auto-revoked by GC independently of our code, which makes spying on the
// real implementation flaky. Mock both so revoke assertions are deterministic.
let objectUrlCounter = 0

beforeEach(() => {
  setActivePinia(createPinia())
  objectUrlCounter = 0
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:mock-${++objectUrlCounter}`)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('addImage', () => {
  it('creates an item with neutral defaults and an object URL', () => {
    const store = useImagesStore()
    const id = store.addImage(makeFile())

    expect(store.images).toHaveLength(1)
    const item = store.images[0]
    expect(item.id).toBe(id)
    expect(item.cropCoordinates).toBeNull()
    expect(item.filter).toBeNull()
    expect(item.adjustments).toEqual(defaultAdjustments)
    expect(item.transform).toEqual(defaultTransform)
    expect(item.url).toMatch(/^blob:/)
  })

  it('gives each image its own adjustments object, not a shared reference', () => {
    const store = useImagesStore()
    store.addImage(makeFile('a.png'))
    store.addImage(makeFile('b.png'))

    store.setAdjustments(store.images[0].id, { brightness: 50, contrast: 100, saturation: 100 })

    expect(store.images[1].adjustments).toEqual(defaultAdjustments)
  })
})

describe('removeImage', () => {
  it('removes the item and revokes its object URL', () => {
    const store = useImagesStore()
    const id = store.addImage(makeFile())
    const url = store.images[0].url

    store.removeImage(id)

    expect(store.images).toHaveLength(0)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url)
  })

  it('is a no-op for an id that does not exist', () => {
    const store = useImagesStore()
    store.addImage(makeFile())

    store.removeImage('does-not-exist')

    expect(store.images).toHaveLength(1)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })
})

describe('per-field setters', () => {
  it('update the matching item in place and ignore unknown ids', () => {
    const store = useImagesStore()
    const id = store.addImage(makeFile())

    const crop = { left: 1, top: 2, width: 3, height: 4 }
    store.setCrop(id, crop)
    store.setAdjustments(id, { brightness: 150, contrast: 100, saturation: 100 })
    store.setFilter(id, 'invert')
    store.setTransform(id, { rotate: 90, flipX: true, flipY: false })

    const item = store.images[0]
    expect(item.cropCoordinates).toEqual(crop)
    expect(item.adjustments.brightness).toBe(150)
    expect(item.filter).toBe('invert')
    expect(item.transform).toEqual({ rotate: 90, flipX: true, flipY: false })

    // None of these should throw for a missing id.
    expect(() => store.setCrop('missing', null)).not.toThrow()
    expect(() => store.setAdjustments('missing', defaultAdjustments)).not.toThrow()
    expect(() => store.setFilter('missing', null)).not.toThrow()
    expect(() => store.setTransform('missing', defaultTransform)).not.toThrow()
  })
})

describe('applyOperations', () => {
  it('overwrites all four edit slots at once', () => {
    const store = useImagesStore()
    const id = store.addImage(makeFile())

    store.applyOperations(id, {
      transform: { rotate: 180, flipX: false, flipY: true },
      crop: { left: 0, top: 0, width: 10, height: 10 },
      adjustments: { brightness: 80, contrast: 120, saturation: 100 },
      filter: 'vintage',
    })

    const item = store.images[0]
    expect(item.transform).toEqual({ rotate: 180, flipX: false, flipY: true })
    expect(item.cropCoordinates).toEqual({ left: 0, top: 0, width: 10, height: 10 })
    expect(item.adjustments).toEqual({ brightness: 80, contrast: 120, saturation: 100 })
    expect(item.filter).toBe('vintage')
  })
})

describe('resetEdits', () => {
  it('nulls crop/filter and restores default adjustments/transform', () => {
    const store = useImagesStore()
    const id = store.addImage(makeFile())
    store.applyOperations(id, {
      transform: { rotate: 90, flipX: true, flipY: true },
      crop: { left: 1, top: 1, width: 5, height: 5 },
      adjustments: { brightness: 50, contrast: 50, saturation: 50 },
      filter: 'sepia',
    })

    store.resetEdits(id)

    const item = store.images[0]
    expect(item.cropCoordinates).toBeNull()
    expect(item.filter).toBeNull()
    expect(item.adjustments).toEqual(defaultAdjustments)
    expect(item.transform).toEqual(defaultTransform)
  })
})
