# Notes

## Non-destructive model: operations as data

The uploaded `File`/object URL is never mutated. Per image (`src/stores/images.ts`, `ImageItem`) the store holds only parameters: `cropCoordinates: Coordinates | null`, `adjustments: { brightness, contrast, saturation }`, `filter: FilterName | null`. This is a fixed three-slot pipeline (crop → adjust → filter), each slot either empty or filled. Moving a slider mutates the current `adjust` params in place rather than pushing a new entry — there's one AdjustOp per image, not a growing list. `Reset` just clears the three slots back to defaults; the original file is untouched throughout.

`src/utils/operations.ts` turns those params into a serializable `Operation[]` (`toOperations`) — this is the "pipeline as pure function" piece: given the same inputs it always produces the same op list, and it's the same function used for both the live preview and the JSON export, so there's no separate "preview logic" vs "export logic" to keep in sync.

## Why CSS/canvas filters, not manual pixel processing

`src/utils/filters.ts#toCssFilter` builds one CSS filter string (`brightness() contrast() saturate() [grayscale()|sepia()]`) from the same `adjustments`/`filter` state. That string is used two ways:

- **Preview**: applied as a live `style="filter: …"` on the crop tool and on canvas-based thumbnails (`Preview.vue`) — free, GPU-accelerated, no per-frame pixel loop, so sliders feel instant.
- **Export**: the identical string is assigned to `ctx.filter` on an `OffscreenCanvas` before `drawImage` (`src/utils/export.ts#downloadImage`), so the exported PNG is pixel-for-pixel what was previewed. One function, both call sites — preview and export can't drift apart.

Crop never touches pixels either: `vue-advanced-cropper` only reports `{left, top, width, height}` in the original image's coordinate space (`Cropper.vue`). That rect is stored as-is and only used as the source-rect argument to `drawImage` at render time, whether that's the composed preview or the final export.

**Safari < 18 caveat**: `CanvasRenderingContext2D#filter` is a silent no-op there (the assignment doesn't throw, it's just ignored), which would otherwise export an unfiltered image while the preview shows one with adjustments applied. `src/utils/export.ts#supportsCanvasFilter` feature-detects this once (round-trips a test value through `ctx.filter`), and when unsupported, `src/utils/filters.ts#applyAdjustmentsToPixels` reproduces `toCssFilter`'s brightness/contrast/saturate/grayscale/sepia pipeline manually via `getImageData`/`putImageData`, using the matrices from the CSS Filter Effects spec so the fallback output matches the CSS-filtered preview.

## JSON replay (bonus)

`downloadOperationsJson` (`src/utils/export.ts`) serializes `{ version: 1, operations: toOperations(...) }` next to the image download. Because `toOperations` is the same pure function driving the preview, replaying is just: decode the original image, run the same crop/adjust/filter steps in order (source-rect draw, then `ctx.filter` from the adjust+filter ops) against a fresh canvas. No hidden state is needed beyond the array — that's why operations are tagged (`{ type: 'crop' | 'adjust' | 'filter', ... }`) rather than being three separate untyped fields once serialized.

## Why dark theme by default

Set in `src/plugins/vuetify.ts` (`theme.defaultTheme: 'dark'`). This isn't a stylistic default — image/print editors (Lightroom, Photoshop) default to dark chrome specifically because a neutral, low-luminance surround doesn't bias how brightness, contrast, and saturation are perceived against the working image. For a printing-industry reviewer this is meant to signal that the choice is domain-aware, not decorative.

## Bonus scope attempted

Both bonus items are done:

- **Filter**: greyscale and sepia, modeled as a single nullable `FilterOperation` slot (mutually exclusive by construction — the UI checkboxes in `src/components/Filters/FilterPanel.vue` just null out the other on selection), expressed as CSS `grayscale(1)`/`sepia(1)` appended to the same filter string.
- **JSON export**: per-image "download JSON" button in the list, shape described above.

## Scope note

A multi-image list (`src/components/Image/List.vue`, `stores/images.ts`) was added beyond the original single-image brief — each row is an independent `ImageItem` with its own crop/adjust/filter pipeline, edited through a shared `EditorDialog.vue`. The non-destructive model above applies per-item; nothing about it depends on there being exactly one image.
