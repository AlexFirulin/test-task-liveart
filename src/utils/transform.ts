export type RotationDegrees = 0 | 90 | 180 | 270

export interface Transform {
  rotate: RotationDegrees
  flipX: boolean
  flipY: boolean
}

export const defaultTransform: Transform = { rotate: 0, flipX: false, flipY: false }

export function isNeutralTransform(transform: Transform): boolean {
  return transform.rotate === 0 && !transform.flipX && !transform.flipY
}

/**
 * vue-advanced-cropper's rotate() is incremental and accumulates without
 * bound (e.g. repeated +90s, or an EXIF-derived starting angle), so its
 * reported `imageTransforms.rotate` can be any integer. Round to the nearest
 * right angle first (defends against float drift from repeated additions),
 * then fold into our 0|90|180|270 range.
 */
export function normalizeRotation(rotate: number): RotationDegrees {
  const rounded = Math.round(rotate / 90) * 90
  return (((rounded % 360) + 360) % 360) as RotationDegrees
}

export function rotatedDimensions(
  rotate: RotationDegrees,
  width: number,
  height: number,
): { width: number; height: number } {
  return rotate === 90 || rotate === 270 ? { width: height, height: width } : { width, height }
}
