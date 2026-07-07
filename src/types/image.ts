import type { Coordinates } from 'vue-advanced-cropper'
import type { Adjustments, FilterName } from './adjustments'
import type { Transform } from './transform'

export interface ImageItem {
  id: string
  file: File
  url: string
  cropCoordinates: Coordinates | null
  adjustments: Adjustments
  filter: FilterName | null
  transform: Transform
}
