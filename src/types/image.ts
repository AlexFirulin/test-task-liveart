import type { Adjustments, FilterName } from './adjustments'
import type { Crop } from './crop'
import type { Transform } from './transform'

export interface ImageItem {
  id: string
  file: File
  url: string
  cropCoordinates: Crop | null
  adjustments: Adjustments
  filter: FilterName | null
  transform: Transform
}
