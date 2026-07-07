# Notes

## Non-destructive model: operations as data

The uploaded `File`/object URL is never mutated. Per image (`src/stores/images.ts`, `ImageItem`) the store holds only parameters: `transform: { rotate, flipX, flipY }`, `cropCoordinates: Coordinates | null`, `adjustments: { brightness, contrast, saturation }`, `filter: FilterName | null`. This is a fixed four-slot pipeline (transform → crop → adjust → filter), each slot either empty/neutral or filled. Moving a slider mutates the current `adjust` params in place rather than pushing a new entry — there's one AdjustOp per image, not a growing list. `Reset` just clears the four slots back to defaults; the original file is untouched throughout.

`src/utils/operations.ts` turns those params into a serializable `Operation[]` (`toOperations`) — this is the "pipeline as pure function" piece: given the same inputs it always produces the same op list, and it's the same function used for both the live preview and the JSON export, so there's no separate "preview logic" vs "export logic" to keep in sync.

**Rotate/flip (`transform`)**: `rotate` is restricted to `0 | 90 | 180 | 270` — no arbitrary angles — specifically so the crop rectangle stays an axis-aligned rectangle after rotation; free-angle rotation would make "crop as a source-rect" (see below) insufficient. The pipeline order is transform → crop, i.e. `cropCoordinates` are defined in the *already-rotated/flipped* image's coordinate space, not the original upload's. `src/utils/render.ts#drawPipeline` is the single place that applies the transform (via `ctx.translate`/`rotate`/`scale` onto an intermediate canvas, swapping width/height for 90°/270°) before drawing the crop source-rect — used by both `Preview.vue` and `export.ts#downloadImage`, so there's no duplicated transform math to keep in sync. The neutral transform (`{0, false, false}`) skips the intermediate canvas entirely.

**Known limitation**: the interactive crop tool in `EditorDialog.vue` shows rotate/flip via a CSS `transform` on the wrapper around `vue-advanced-cropper` — cosmetic only. The cropper library itself still measures against the *original, unrotated* image, so its reported `Coordinates` are in original-image space, not the rotated space the storage contract expects. Building a fully accurate rotated crop tool would mean feeding the library a pre-rendered rotated bitmap instead of the original `src`, which is out of scope here; combining crop with rotate/flip on the same image is a known rough edge worth flagging to a reviewer.

## Why CSS/canvas filters, not manual pixel processing

`src/utils/filters.ts#toCssFilter` builds one CSS filter string (`brightness() contrast() saturate()` plus the selected preset's snippet from `FILTER_CSS`, if any) from the same `adjustments`/`filter` state. That string is used two ways:

- **Live crop-tool preview** (while editing, before Apply): applied as a `style="filter: …"` on the wrapper around the interactive cropper — free, GPU-accelerated, no per-frame pixel loop, so sliders feel instant while dragging.
- **Thumbnails and export**: baked directly into canvas pixels via `ctx.filter` inside `src/utils/render.ts#drawPipeline`, the one function used by both `Preview.vue` (list thumbnails) and `src/utils/export.ts#downloadImage`, so the exported PNG is pixel-for-pixel what was previewed. One function, every call site — preview and export can't drift apart.

Crop never touches pixels either: `vue-advanced-cropper` only reports `{left, top, width, height}` in the original image's coordinate space (`Cropper.vue`). That rect is stored as-is and only used as the source-rect argument to `drawImage` at render time, whether that's the composed preview or the final export.

**Safari < 18 caveat**: `CanvasRenderingContext2D#filter` is a silent no-op there (the assignment doesn't throw, it's just ignored), which would otherwise export an unfiltered image while the preview shows one with adjustments applied. `src/utils/render.ts#supportsCanvasFilter` feature-detects this once (round-trips a test value through `ctx.filter`), and when unsupported, `src/utils/filters.ts#applyAdjustmentsToPixels` reproduces `toCssFilter`'s brightness/contrast/saturate/grayscale/sepia pipeline manually via `getImageData`/`putImageData`, using the matrices from the CSS Filter Effects spec so the fallback output matches the CSS-filtered preview.

## JSON replay (bonus)

`downloadOperationsJson` (`src/utils/export.ts`) serializes `{ version: 1, operations: toOperations(...) }` next to the image download. Because `toOperations` is the same pure function driving the preview, replaying is just: decode the original image, run the same transform/crop/adjust/filter steps in order (canvas transform, source-rect draw, then `ctx.filter` from the adjust+filter ops) against a fresh canvas. No hidden state is needed beyond the array — that's why operations are tagged (`{ type: 'transform' | 'crop' | 'adjust' | 'filter', ... }`) rather than being untyped fields once serialized.

JSON isn't just exported anymore — it can be re-imported too, via the per-image "import JSON" button in `List.vue`. `src/utils/operations.ts#fromOperations` is the strict inverse of `toOperations` (missing slots fall back to the same neutral defaults `toOperations` treats as "omit"), and `parseOperationsFile` validates a raw JSON string field-by-field before calling it — no `Number(x) ?? fallback`-style silent coercion; a missing/wrong-typed field, an unknown operation `type`, an out-of-range `rotate`/`filter.name`, a duplicate operation type, or an unsupported `version` all throw a specific error instead. As a final check, `parseOperationsFile` re-runs `toOperations` on the value it's about to return and requires the result to exactly match the parsed array — since it's the same function that drives the live preview and the export, this one assertion is what guarantees the import round-trips byte-for-byte with what was exported, and it also catches malformed-but-individually-valid input (wrong operation order, an explicitly-included no-op) that field-level checks alone wouldn't. The store's `applyOperations(id, input)` then just writes the four fields straight into the existing `ImageItem` slots — no parallel "apply an operations list" code path, it's the same state everything else already reads from.

## Why dark theme by default

Set in `src/plugins/vuetify.ts` (`theme.defaultTheme: 'dark'`). This isn't a stylistic default — image/print editors (Lightroom, Photoshop) default to dark chrome specifically because a neutral, low-luminance surround doesn't bias how brightness, contrast, and saturation are perceived against the working image. For a printing-industry reviewer this is meant to signal that the choice is domain-aware, not decorative.

## Bonus scope attempted

Both bonus items are done:

- **Filter**: six presets (greyscale, sepia, invert, warm, cool, vintage), still modeled as a single nullable `FilterOperation` slot (`src/utils/filters.ts#FILTER_CSS`, a `Record<FilterName, string>` keyed by name) — mutually exclusive by construction, now via a single-select `v-chip-group` in `src/components/Filters/FilterPanel.vue` (clicking the active chip again clears it back to `null`, same "exactly one or none" semantics as the old checkbox pair) instead of two checkboxes.
- **JSON export**: per-image "download JSON" button in the list, shape described above.

Deliberately not adding `blur()` or any other filter expressed in absolute pixels: a blur radius is a fixed pixel count, not scale-invariant, so it would look different on a downscaled thumbnail preview than in the full-resolution export — breaking the "preview = export" guarantee everything else here is built around. All filter presets are kept to percentage/angle-based CSS functions (`sepia()`, `saturate()`, `hue-rotate()`, `brightness()`, `contrast()`, `invert()`) for exactly this reason.

## Scope note

A multi-image list (`src/components/Image/List.vue`, `stores/images.ts`) was added beyond the original single-image brief — each row is an independent `ImageItem` with its own transform/crop/adjust/filter pipeline, edited through a shared `EditorDialog.vue`. The non-destructive model above applies per-item; nothing about it depends on there being exactly one image.

Rotate (±90°) and horizontal/vertical flip were added beyond the original brief too, following the same non-destructive, operations-as-data shape — see the "Rotate/flip" and "Known limitation" notes above.
