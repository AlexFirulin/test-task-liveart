import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAdjustments } from '../../src/utils/filters'
import type { PipelineItem } from '../../src/utils/render'
import type * as RenderModule from '../../src/utils/render'
import { defaultTransform } from '../../src/utils/transform'

type DrawPipeline = typeof RenderModule.drawPipeline
type Ctx = Parameters<DrawPipeline>[0]
type Img = Parameters<DrawPipeline>[1]

interface RecordedCall {
  method: string
  args: unknown[]
}

// A minimal duck-typed stand-in for CanvasRenderingContext2D /
// OffscreenCanvasRenderingContext2D — only the members drawPipeline actually
// touches. `filterSupported` (module-level, flipped per test) makes the
// setter a no-op when false, mirroring how Safari < 18 silently drops
// `ctx.filter` assignments instead of erroring.
class FakeContext {
  canvas: FakeOffscreenCanvas
  calls: RecordedCall[] = []
  private filterValue = 'none'

  constructor(canvas: FakeOffscreenCanvas) {
    this.canvas = canvas
  }

  get filter(): string {
    return this.filterValue
  }

  set filter(value: string) {
    if (filterSupported) this.filterValue = value
  }

  translate(...args: unknown[]): void {
    this.calls.push({ method: 'translate', args })
  }

  rotate(...args: unknown[]): void {
    this.calls.push({ method: 'rotate', args })
  }

  scale(...args: unknown[]): void {
    this.calls.push({ method: 'scale', args })
  }

  drawImage(...args: unknown[]): void {
    this.calls.push({ method: 'drawImage', args })
  }

  getImageData(x: number, y: number, width: number, height: number) {
    this.calls.push({ method: 'getImageData', args: [x, y, width, height] })
    return { data: new Uint8ClampedArray(width * height * 4).fill(150) }
  }

  putImageData(imageData: unknown, x: number, y: number): void {
    this.calls.push({ method: 'putImageData', args: [imageData, x, y] })
  }
}

class FakeOffscreenCanvas {
  width: number
  height: number
  context = new FakeContext(this)

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    createdCanvases.push(this)
  }

  getContext(type: string): FakeContext | null {
    return type === '2d' ? this.context : null
  }
}

let filterSupported = true
let createdCanvases: FakeOffscreenCanvas[] = []

function makeImage(naturalWidth: number, naturalHeight: number): Img {
  return { naturalWidth, naturalHeight } as unknown as Img
}

function makeOutput(width: number, height: number) {
  const canvas = new FakeOffscreenCanvas(width, height)
  return { canvas, ctx: canvas.getContext('2d') as FakeContext }
}

async function importDrawPipeline(): Promise<DrawPipeline> {
  const mod = await import('../../src/utils/render')
  return mod.drawPipeline
}

beforeEach(() => {
  vi.resetModules() // clears render.ts's memoized canvasFilterSupported cache
  createdCanvases = []
  filterSupported = true
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('drawPipeline', () => {
  it('draws the full image and bakes the CSS filter when ctx.filter is supported', async () => {
    const drawPipeline = await importDrawPipeline()
    const { canvas, ctx } = makeOutput(1, 1)
    const image = makeImage(4, 3)
    const item: PipelineItem = {
      cropCoordinates: null,
      adjustments: defaultAdjustments,
      filter: null,
      transform: defaultTransform,
    }

    await drawPipeline(ctx as unknown as Ctx, image, item)

    expect(canvas.width).toBe(4)
    expect(canvas.height).toBe(3)
    expect(ctx.filter).toBe('brightness(100%) contrast(100%) saturate(100%)')
    expect(ctx.calls).toContainEqual({
      method: 'drawImage',
      args: [image, 0, 0, 4, 3, 0, 0, 4, 3],
    })
    expect(ctx.calls.some((call) => call.method === 'getImageData')).toBe(false)
    expect(ctx.calls.some((call) => call.method === 'putImageData')).toBe(false)
  })

  it('uses the crop rectangle as both source-rect and output canvas size', async () => {
    const drawPipeline = await importDrawPipeline()
    const { canvas, ctx } = makeOutput(1, 1)
    const image = makeImage(10, 10)
    const item: PipelineItem = {
      cropCoordinates: { left: 2, top: 3, width: 4, height: 5 },
      adjustments: defaultAdjustments,
      filter: null,
      transform: defaultTransform,
    }

    await drawPipeline(ctx as unknown as Ctx, image, item)

    expect(canvas.width).toBe(4)
    expect(canvas.height).toBe(5)
    expect(ctx.calls).toContainEqual({
      method: 'drawImage',
      args: [image, 2, 3, 4, 5, 0, 0, 4, 5],
    })
  })

  it('rotates and flips onto an intermediate canvas before the final draw', async () => {
    const drawPipeline = await importDrawPipeline()
    const { canvas, ctx } = makeOutput(1, 1)
    const image = makeImage(6, 4)
    const item: PipelineItem = {
      cropCoordinates: null,
      adjustments: defaultAdjustments,
      filter: null,
      transform: { rotate: 90, flipX: true, flipY: false },
    }

    await drawPipeline(ctx as unknown as Ctx, image, item)

    // rotatedDimensions(90, 6, 4) swaps to 4x6, so the output canvas and the
    // intermediate transform canvas are both sized 4x6.
    expect(canvas.width).toBe(4)
    expect(canvas.height).toBe(6)

    const transformCanvas = createdCanvases.find(
      (c) => c !== canvas && c.width === 4 && c.height === 6,
    )
    expect(transformCanvas).toBeDefined()
    const transformCtx = transformCanvas!.context
    expect(transformCtx.calls).toEqual([
      { method: 'translate', args: [2, 3] },
      { method: 'rotate', args: [Math.PI / 2] },
      { method: 'scale', args: [-1, 1] },
      { method: 'drawImage', args: [image, -3, -2, 6, 4] },
    ])

    // The final draw reads from the intermediate canvas, not the raw image.
    expect(ctx.calls).toContainEqual({
      method: 'drawImage',
      args: [transformCanvas, 0, 0, 4, 6, 0, 0, 4, 6],
    })
  })

  it('falls back to per-pixel adjustments when ctx.filter is unsupported', async () => {
    filterSupported = false
    const drawPipeline = await importDrawPipeline()
    const { canvas, ctx } = makeOutput(1, 1)
    const image = makeImage(2, 2)
    const item: PipelineItem = {
      cropCoordinates: null,
      adjustments: { ...defaultAdjustments, brightness: 200 },
      filter: null,
      transform: defaultTransform,
    }

    await drawPipeline(ctx as unknown as Ctx, image, item)

    expect(canvas.width).toBe(2)
    expect(canvas.height).toBe(2)
    // ctx.filter is never assigned at all on the unsupported path (drawPipeline
    // only sets it when supportsCanvasFilter() is true), so it stays default.
    expect(ctx.filter).toBe('none')

    const methods = ctx.calls.map((call) => call.method)
    expect(methods).toEqual(['drawImage', 'getImageData', 'putImageData'])

    const putCall = ctx.calls.find((call) => call.method === 'putImageData')!
    const putData = (putCall.args[0] as { data: Uint8ClampedArray }).data
    // Source pixels are 150 (see FakeContext#getImageData); brightness(200%)
    // doubles and clamps: 150*2 = 300 -> 255.
    expect(putData[0]).toBe(255)
  })
})
