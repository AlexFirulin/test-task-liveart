export type RotationDegrees = 0 | 90 | 180 | 270

export interface Transform {
  rotate: RotationDegrees
  flipX: boolean
  flipY: boolean
}
