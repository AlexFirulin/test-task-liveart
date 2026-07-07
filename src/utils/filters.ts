import type { Adjustments, FilterName } from '../types/adjustments'

export const defaultAdjustments: Adjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
}

export function isNeutralAdjustments(adjustments: Adjustments): boolean {
  return (
    adjustments.brightness === defaultAdjustments.brightness &&
    adjustments.contrast === defaultAdjustments.contrast &&
    adjustments.saturation === defaultAdjustments.saturation
  )
}

const FILTER_CSS: Record<FilterName, string> = {
  greyscale: 'grayscale(1)',
  sepia: 'sepia(1)',
  invert: 'invert(100%)',
  warm: 'sepia(30%) saturate(140%) hue-rotate(-10deg)',
  cool: 'saturate(120%) hue-rotate(10deg) brightness(102%)',
  vintage: 'sepia(50%) contrast(85%) brightness(105%) saturate(120%)',
}

export function toCssFilter(adjustments: Adjustments, filter: FilterName | null = null): string {
  const parts = [
    `brightness(${adjustments.brightness}%)`,
    `contrast(${adjustments.contrast}%)`,
    `saturate(${adjustments.saturation}%)`,
  ]
  if (filter) parts.push(FILTER_CSS[filter])
  return parts.join(' ')
}

function clamp255(value: number): number {
  return Math.min(255, Math.max(0, value))
}

interface AdjustmentParams {
  brightness: number
  contrast: number
  saturation: number
  contrastIntercept: number
}

function computeAdjustmentParams(adjustments: Adjustments): AdjustmentParams {
  const contrast = adjustments.contrast / 100
  return {
    brightness: adjustments.brightness / 100,
    contrast,
    saturation: adjustments.saturation / 100,
    contrastIntercept: (0.5 - 0.5 * contrast) * 255,
  }
}

/** Processes one contiguous byte range of `data` in place — the shared inner loop for both the single-pass and chunked entry points below. */
function applyAdjustmentsRange(
  data: Uint8ClampedArray,
  start: number,
  end: number,
  { brightness, contrast, saturation, contrastIntercept }: AdjustmentParams,
  filter: FilterName | null,
): void {
  for (let i = start; i < end; i += 4) {
    let r = data[i] * brightness
    let g = data[i + 1] * brightness
    let b = data[i + 2] * brightness

    r = contrast * r + contrastIntercept
    g = contrast * g + contrastIntercept
    b = contrast * b + contrastIntercept

    const sr = r
    const sg = g
    const sb = b
    r =
      (0.213 + 0.787 * saturation) * sr +
      (0.715 - 0.715 * saturation) * sg +
      (0.072 - 0.072 * saturation) * sb
    g =
      (0.213 - 0.213 * saturation) * sr +
      (0.715 + 0.285 * saturation) * sg +
      (0.072 - 0.072 * saturation) * sb
    b =
      (0.213 - 0.213 * saturation) * sr +
      (0.715 - 0.715 * saturation) * sg +
      (0.072 + 0.928 * saturation) * sb

    if (filter === 'greyscale') {
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
      r = gray
      g = gray
      b = gray
    } else if (filter === 'sepia') {
      const sr2 = r
      const sg2 = g
      const sb2 = b
      r = 0.393 * sr2 + 0.769 * sg2 + 0.189 * sb2
      g = 0.349 * sr2 + 0.686 * sg2 + 0.168 * sb2
      b = 0.272 * sr2 + 0.534 * sg2 + 0.131 * sb2
    }

    data[i] = clamp255(r)
    data[i + 1] = clamp255(g)
    data[i + 2] = clamp255(b)
  }
}

// Canvases at or under this pixel count run in a single synchronous pass —
// chunking has no benefit there and would only add a wasted rAF round-trip.
const CHUNKING_PIXEL_THRESHOLD = 4_000_000 // ~2000x2000
const ROWS_PER_CHUNK = 200

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

/**
 * Pixel-space fallback for browsers where CanvasRenderingContext2D#filter is a
 * no-op (e.g. Safari < 18), applied in the same order as toCssFilter
 * (brightness -> contrast -> saturate -> filter) using the matrices from the
 * CSS Filter Effects spec (https://www.w3.org/TR/filter-effects-1/#FilterPrimitiveRepresentation),
 * so the exported pixels match the CSS-filtered preview. Only covers
 * greyscale/sepia so far — invert/warm/cool/vintage (FILTER_CSS above) fall
 * back to the brightness/contrast/saturate result alone on unsupported
 * browsers, i.e. the filter itself is dropped there.
 *
 * Above CHUNKING_PIXEL_THRESHOLD, processes ROWS_PER_CHUNK rows at a time with
 * a requestAnimationFrame yield between chunks, so a large canvas (only ever
 * hit on the Safari < 18 fallback path, but still) doesn't block the main
 * thread for seconds in one tight loop.
 */
export async function applyAdjustmentsToPixels(
  data: Uint8ClampedArray,
  width: number,
  adjustments: Adjustments,
  filter: FilterName | null,
): Promise<void> {
  const params = computeAdjustmentParams(adjustments)

  const totalPixels = data.length / 4
  if (totalPixels <= CHUNKING_PIXEL_THRESHOLD || width <= 0) {
    applyAdjustmentsRange(data, 0, data.length, params, filter)
    return
  }

  const bytesPerRow = width * 4
  const chunkBytes = bytesPerRow * ROWS_PER_CHUNK
  for (let start = 0; start < data.length; start += chunkBytes) {
    const end = Math.min(data.length, start + chunkBytes)
    applyAdjustmentsRange(data, start, end, params, filter)
    await nextFrame()
  }
}
