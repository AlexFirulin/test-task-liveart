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

const ROTATIONS: RotationDegrees[] = [0, 90, 180, 270]

export function rotateLeft(rotate: RotationDegrees): RotationDegrees {
  return ROTATIONS[(ROTATIONS.indexOf(rotate) + 3) % 4]
}

export function rotateRight(rotate: RotationDegrees): RotationDegrees {
  return ROTATIONS[(ROTATIONS.indexOf(rotate) + 1) % 4]
}

export function rotatedDimensions(
  rotate: RotationDegrees,
  width: number,
  height: number,
): { width: number; height: number } {
  return rotate === 90 || rotate === 270 ? { width: height, height: width } : { width, height }
}

/**
 * Visual-only CSS equivalent of the transform, for previewing rotate/flip on
 * the interactive crop tool while editing. The crop tool's own coordinates
 * stay in the original image's space either way — draftTransform (not this
 * string) is the source of truth applied by drawPipeline at render time.
 */
export function toCssTransform(transform: Transform): string {
  const parts: string[] = []
  if (transform.rotate !== 0) parts.push(`rotate(${transform.rotate}deg)`)
  if (transform.flipX || transform.flipY) {
    parts.push(`scale(${transform.flipX ? -1 : 1}, ${transform.flipY ? -1 : 1})`)
  }
  return parts.join(' ')
}
