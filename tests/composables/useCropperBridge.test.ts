import { describe, expect, it, vi } from 'vitest'
import type ImageCropper from '../../src/components/Image/Cropper.vue'
import { useCropperBridge } from '../../src/composables/useCropperBridge'
import type { Crop } from '../../src/types/crop'
import type { Transform } from '../../src/types/transform'

type FakeCropper = InstanceType<typeof ImageCropper>

function makeFakeCropper(overrides: Partial<FakeCropper> = {}): FakeCropper {
  return {
    reset: vi.fn(async () => {}),
    applyTransform: vi.fn(),
    rotate: vi.fn(),
    flip: vi.fn(),
    ...overrides,
  } as unknown as FakeCropper
}

const crop: Crop = { left: 0, top: 0, width: 10, height: 10 }
const transform: Transform = { rotate: 90, flipX: false, flipY: false }

describe('useCropperBridge', () => {
  it('restoreTo(null, transform) resets first, then applies the transform', async () => {
    const bridge = useCropperBridge(vi.fn())
    const fake = makeFakeCropper()
    bridge.cropperRef.value = fake

    await bridge.restoreTo(null, transform)

    expect(fake.reset).toHaveBeenCalledTimes(1)
    expect(fake.applyTransform).toHaveBeenCalledWith(transform)
  })

  it('restoreTo(crop, transform) does not reset when a crop is given', async () => {
    const bridge = useCropperBridge(vi.fn())
    const fake = makeFakeCropper()
    bridge.cropperRef.value = fake

    await bridge.restoreTo(crop, transform)

    expect(fake.reset).not.toHaveBeenCalled()
    expect(fake.applyTransform).toHaveBeenCalledWith(transform)
  })

  it('handleChange reports isUserInitiated: true for a change outside of restoreTo', () => {
    const onChange = vi.fn()
    const bridge = useCropperBridge(onChange)

    bridge.handleChange(crop, transform)

    expect(onChange).toHaveBeenCalledWith(crop, transform, true)
  })

  it('handleChange reports isUserInitiated: false for a change the bridge triggers itself during restoreTo', async () => {
    const onChange = vi.fn()
    const bridge = useCropperBridge(onChange)
    const fake = makeFakeCropper({
      applyTransform: vi.fn(() => {
        // Simulates vue-advanced-cropper synchronously firing its own
        // `change` event as a side effect of applyTransform — the real
        // library does this, per Cropper.vue's onChange wiring.
        bridge.handleChange(crop, transform)
      }),
    })
    bridge.cropperRef.value = fake

    await bridge.restoreTo(crop, transform)

    expect(onChange).toHaveBeenCalledWith(crop, transform, false)
  })

  it('treats a change reported after restoreTo has resolved as user-initiated again', async () => {
    const onChange = vi.fn()
    const bridge = useCropperBridge(onChange)
    const fake = makeFakeCropper()
    bridge.cropperRef.value = fake

    await bridge.restoreTo(null, { rotate: 0, flipX: false, flipY: false })
    onChange.mockClear()

    bridge.handleChange(crop, transform)

    expect(onChange).toHaveBeenCalledWith(crop, transform, true)
  })

  it('rotate/flip call straight through to the current cropper instance', () => {
    const bridge = useCropperBridge(vi.fn())
    const fake = makeFakeCropper()
    bridge.cropperRef.value = fake

    bridge.rotate(-90)
    bridge.flip(true, false)

    expect(fake.rotate).toHaveBeenCalledWith(-90)
    expect(fake.flip).toHaveBeenCalledWith(true, false)
  })

  it('rotate/flip/restoreTo are no-ops when no cropper instance is mounted yet', async () => {
    const bridge = useCropperBridge(vi.fn())

    expect(() => bridge.rotate(90)).not.toThrow()
    expect(() => bridge.flip(true, true)).not.toThrow()
    await expect(bridge.restoreTo(crop, transform)).resolves.toBeUndefined()
  })
})
