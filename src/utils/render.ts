import type { Coordinates } from 'vue-advanced-cropper'
import { type Adjustments, type FilterName, applyAdjustmentsToPixels, toCssFilter } from './filters'
import { type Transform, isNeutralTransform, rotatedDimensions } from './transform'

export interface PipelineItem {
  cropCoordinates: Coordinates | null
  adjustments: Adjustments
  filter: FilterName | null
  transform: Transform
}

type Canvas2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
type PipelineImage = CanvasImageSource & { naturalWidth: number; naturalHeight: number }

let canvasFilterSupported: boolean | null = null

/**
 * Safari < 18 accepts CanvasRenderingContext2D#filter without error but
 * silently ignores it (stays 'none'), so probe it once by round-tripping a
 * distinctive value instead of trusting the assignment to have worked.
 */
function supportsCanvasFilter(): boolean {
  if (canvasFilterSupported !== null) return canvasFilterSupported
  const testCtx = new OffscreenCanvas(1, 1).getContext('2d')
  if (!testCtx) {
    canvasFilterSupported = false
    return canvasFilterSupported
  }
  testCtx.filter = 'blur(4px)'
  canvasFilterSupported = testCtx.filter === 'blur(4px)'
  return canvasFilterSupported
}

/**
 * Renders the image rotated/flipped per `transform` onto a correctly-sized
 * intermediate canvas (dimensions swap for 90/270). Skipped for the neutral
 * transform (the common case) so no-op edits don't pay for an extra canvas.
 */
function getTransformedSource(
  image: PipelineImage,
  transform: Transform,
): { source: CanvasImageSource; width: number; height: number } {
  const naturalWidth = image.naturalWidth
  const naturalHeight = image.naturalHeight
  if (isNeutralTransform(transform)) {
    return { source: image, width: naturalWidth, height: naturalHeight }
  }

  const { width, height } = rotatedDimensions(transform.rotate, naturalWidth, naturalHeight)
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return { source: image, width: naturalWidth, height: naturalHeight }

  ctx.translate(width / 2, height / 2)
  ctx.rotate((transform.rotate * Math.PI) / 180)
  ctx.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1)
  ctx.drawImage(image, -naturalWidth / 2, -naturalHeight / 2, naturalWidth, naturalHeight)

  return { source: canvas, width, height }
}

/**
 * The single rendering path shared by the live preview and the export: applies
 * `transform` (rotate/flip) via canvas transforms, then draws the crop
 * rectangle — already in the *transformed* image's coordinate space — as a
 * source-rect into ctx's canvas (resizing it to the crop size), then bakes
 * adjustments/filter via the identical CSS filter string used everywhere else
 * (or the manual pixel fallback where ctx.filter isn't supported). One
 * function, every call site, so preview and export can never drift apart.
 */
export function drawPipeline(ctx: Canvas2DContext, image: PipelineImage, item: PipelineItem): void {
  const { source, width, height } = getTransformedSource(image, item.transform)

  const crop = item.cropCoordinates ?? { left: 0, top: 0, width, height }

  const canvas = ctx.canvas
  canvas.width = crop.width
  canvas.height = crop.height

  const filterSupported = supportsCanvasFilter()
  if (filterSupported) ctx.filter = toCssFilter(item.adjustments, item.filter)
  ctx.drawImage(source, crop.left, crop.top, crop.width, crop.height, 0, 0, crop.width, crop.height)

  if (!filterSupported) {
    const imageData = ctx.getImageData(0, 0, crop.width, crop.height)
    applyAdjustmentsToPixels(imageData.data, item.adjustments, item.filter)
    ctx.putImageData(imageData, 0, 0)
  }
}
