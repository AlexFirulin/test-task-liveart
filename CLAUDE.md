# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A take-home test task: a browser-based, non-destructive image editor (Vue 3 + Vuetify 3 + Pinia + TypeScript). The brief (full text in `README.md`) explicitly cares more about how edits are *modeled* than about UI polish — reviewers are expected to read the Pinia store and the `src/utils/*` pure functions. `NOTES.md` is the submission write-up explaining the design decisions (operations-as-data model, why CSS/canvas filters, JSON replay shape, why dark theme, bonus scope) — read it before making architectural changes so new code stays consistent with the rationale already given.

## Commands

- `npm i && npm run dev` — install and start the Vite dev server (this is the required "it must run" command from the brief).
- `npm run build` — type-checks (`vue-tsc -b`) then production-builds (`vite build`). This is also the type-check command; there is no separate `typecheck` script.
- `npm run preview` — serve the production build locally.

There is no lint script and no test suite configured. `tsconfig.app.json` has `noUnusedLocals`/`noUnusedParameters` on, so `npm run build` will fail on unused variables/params — treat that as the correctness gate.

No path aliases are configured; all imports are relative.

## Core architecture: operations as data

The central design constraint is non-destructive editing. Nothing about an uploaded image is ever mutated in place; instead the app accumulates *parameters* describing edits, and rendering (preview and export) is a pure function of `(original, parameters)`.

- **Store** (`src/stores/images.ts`, `useImagesStore`): holds `images: ImageItem[]`. Each `ImageItem` is one independent, non-destructive editing session:
  - `file`/`url` — the original upload, an object URL, never rewritten.
  - `transform: { rotate: 0|90|180|270, flipX, flipY }` — rotate is restricted to right-angle multiples (no arbitrary angles) specifically so the crop rectangle stays axis-aligned after rotation. Pipeline order is transform → crop → adjust → filter, so `cropCoordinates` are defined in the *already-transformed* image's coordinate space.
  - `cropCoordinates: Coordinates | null` — from `vue-advanced-cropper`, in the transformed image's coordinate space. Crop never actually cuts pixels; it's only ever used later as the source-rect argument to `drawImage`.
  - `adjustments: { brightness, contrast, saturation }` — a fixed slot, mutated in place by the sliders (not appended to a list).
  - `filter: FilterName | null` — a single nullable slot (`'greyscale' | 'sepia'`), so only one filter can be active at a time by construction.
  - `resetEdits`/`Reset` just nulls these four slots back to defaults — the original file is untouched throughout.
- **`src/utils/filters.ts#toCssFilter(adjustments, filter)`**: builds one canonical CSS filter string (`brightness() contrast() saturate() [grayscale()|sepia()]`), used for the live crop-tool preview (as a CSS `style.filter`) and, via `drawPipeline` below, baked into canvas pixels for thumbnails and export — one function, so preview and export can never drift apart. `applyAdjustmentsToPixels` is the manual pixel-math fallback for browsers where `ctx.filter` is unsupported (Safari < 18).
- **`src/utils/transform.ts`**: `Transform` type + `defaultTransform`/`isNeutralTransform`/`rotatedDimensions` (swaps width/height for 90°/270°, used by `drawPipeline`'s export-side canvas rotation) and `normalizeRotation` (rounds to the nearest right angle and folds into `0|90|180|270`, used to make sense of `vue-advanced-cropper`'s unbounded accumulated rotate angle — see `EditorPanel.vue` below).
- **`src/utils/render.ts#drawPipeline(ctx, image, item)`**: the single rendering function — applies `transform` via `ctx.translate`/`rotate`/`scale` onto an intermediate canvas (skipped when transform is neutral), draws the crop as a source-rect from that, then bakes `adjustments`/`filter` via `ctx.filter` (or the manual pixel fallback, `supportsCanvasFilter` feature-detects this once). Used by both `Preview.vue` and `export.ts#downloadImage` — no duplicated drawImage/transform math between preview and export.
- **`src/utils/operations.ts#toOperations(...)`**: derives a serializable, tagged `Operation[]` (`{type: 'transform'|'crop'|'adjust'|'filter', ...}`) from the same store state, using the same "only include non-neutral slots" logic, in pipeline order. This is what gets JSON-exported (the bonus requirement) and is what a replay would run against the original image.
- **`src/utils/export.ts`**: `downloadImage` renders via `drawPipeline` + `convertToBlob` (bakes pixels only here, never during live crop-tool editing); `downloadOperationsJson` serializes `{version, operations}` via `toOperations`.
- **`src/components/Image/Preview.vue`**: the shared preview renderer — calls `drawPipeline` to draw transform+crop+filter onto a `<canvas>`, so it's reused unmodified for both list thumbnails and the full-size preview.

When extending the edit model (e.g. adding a new adjustment or filter), keep the same shape: add a field to `ImageItem`, extend `toCssFilter`/`toOperations`/`drawPipeline` together so preview/export/JSON stay in sync, and don't introduce per-edit mutation of pixel data.

## Component / data flow

The editor is a permanent two-column layout, not a modal: `App.vue` renders an upload/list column next to an always-mounted `EditorPanel.vue`. There is no "open/close the editor" state anymore — only *which* image is active (`editingId`).

- **`App.vue`** is the orchestrator: owns transient UI state (`editingId`, `isNewUpload`) and wires `useImagesStore` to the panel. It does not hold any editing state itself.
  - `openEditor(id, isNew)` is the only place `editingId`/`isNewUpload` change when switching the active image. It preloads the new image's `url` *before* flipping `editingId` (so the crop tool doesn't flash blank/loading — the same reason the old modal used `eager` + preload-before-open), and if the image being switched *away from* was an unapplied new upload, it removes it from the store first — abandoning it, same as explicitly discarding it.
  - `applyEdits` additionally clears `isNewUpload` after a successful Apply: once applied, the image is a saved image like any other, so its panel's "Cancel" should revert to the (now-updated) stored values, not offer to delete it.
  - `removeImage` wraps `imagesStore.removeImage` to also clear `editingId` (back to the placeholder) when the deleted image was the active one.
- **`src/components/Image/Uploader.vue`** is a full drop-zone card (not an icon button): click-to-browse or drag-and-drop, accepts multiple files, filters by `type.startsWith('image/')`, and emits one `select: File[]` event for the accepted batch (rejected names surface in a local `v-snackbar`). It stop-propagates its own drag events so a drop on the card doesn't *also* bubble to `App.vue`'s page-wide drop zone and double-add the same files.
- **`src/components/Image/List.vue`** renders one row per `ImageItem` (thumbnail via `Preview.vue`, edit/download/JSON export+import/delete actions), highlighting the row matching its `activeId` prop.
- **`src/components/Image/EditorPanel.vue`** is a `v-card` (no `v-dialog`) that's always mounted; it renders a placeholder when `src` is `null` and the full editor otherwise. It holds *draft* copies of transform/crop/adjustments/filter — nothing is written back to the store until **Apply**. Both **Apply** and **Cancel** clear `editingId` back to the placeholder afterward (`App.vue#applyEdits`/`cancelEdit`) — editing one image at a time, then returning to the list, rather than staying parked on the same picture.
  - **Rotate/flip go through the cropper's own API**, not CSS: the rotate/flip buttons call `cropperRef.value?.rotate(±90)` / `.flip(h, v)` (exposed by `Cropper.vue`, which forwards to `vue-advanced-cropper`'s native methods with `{ transitions: false }` — its `.d.ts` doesn't declare that 3rd argument even though the runtime accepts it, hence a cast there). A CSS `transform: rotate()` on the wrapper was tried first and reverted: it doesn't affect layout, so a rotated wide image would visually overflow past the panel into the page below it. The cropper's native rotate handles its own layout instead.
  - **`draftTransform` is a readout, not a target**: `onCropperChange` (bound to the cropper's `@change`) is the *only* place that writes `draftCrop`/`draftTransform`, from whatever `coordinates`/`imageTransforms` the cropper reports — including in response to our own `rotate()`/`flip()` calls. `imageTransforms.rotate` is unbounded/incremental (it's `+=`'d internally), so it's run through `normalizeRotation` before landing in `draftTransform`.
  - **Restoring a saved transform is delta-based**: `rotate()`/`flip()` are both incremental (rotate adds to the current angle, flip toggles per axis), so there's no "set to absolute value" call to make. `applyCropperState(targetCrop, targetTransform)` reads the cropper's last-reported `cropperTransforms` and computes+applies just the delta needed to reach the target — this is what backs `resetDraft` (delta to `defaultTransform`) and image-switch restoration.
  - **Image-switch restoration waits for `@ready`, not the `editingId` watcher**: switching `src` makes the library reset its own internal rotate/flip asynchronously (EXIF-orientation-aware) before it emits `ready` — computing a delta any earlier would race that reset and get silently overwritten. `seedNonCropperDraft` (adjustments/filter/aspect-ratio, no cropper dependency) still runs synchronously off `watch(() => props.editingId, ...)`; `onCropperReady` does the crop/transform restoration once the *new* image is actually settled.
  - **Cancel always returns to the placeholder** (`emit('cancel')` → `App.vue#cancelEdit` clears `editingId`), but only *deletes* the image when it's an unapplied new upload (`isNewUpload`) — labeled "Discard upload" (destructive, `color="error"`) versus plain "Cancel" for an already-saved image (just walks away from the draft; nothing was mutated since draft state never touched the store before Apply).
  - **Layout safety net**: the cropper-wrapping `.cropper-zone` has `max-height: 60vh; overflow: hidden` regardless of the above — belt-and-suspenders in case anything else ever pushes the cropper's rendered size past reasonable bounds.
- **`src/components/Image/Cropper.vue`** is a thin wrapper around `vue-advanced-cropper`'s `Cropper`, exposing `reset()` and emitting `change` with raw `Coordinates` — it holds no store knowledge.
- **`src/components/Filters/AdjustmentsPanel.vue`** / **`src/components/Filters/FilterPanel.vue`** are controlled, store-agnostic `v-model` components (three sliders; a single-select `v-chip-group` over the filter presets since the store's `filter` slot is single-valued).

## Vuetify configuration (`src/plugins/vuetify.ts`)

- Dark theme is the default — this is a deliberate, domain-informed choice (matches how professional image/print editors default to dark chrome so it doesn't bias brightness/contrast/saturation perception), not a stylistic default. See `NOTES.md` for the full rationale.
- Icons use the **font-based** `vuetify/iconsets/mdi` (+ `@mdi/font`), not `vuetify/iconsets/mdi-svg`. This was a deliberate fix: `mdi-svg` only ships path data for Vuetify's own internal aliases (close, checkbox, etc.), not arbitrary `mdi-*` names like `mdi-crop`/`mdi-pencil`/`mdi-download` used throughout this app — switching iconsets would silently blank out every icon button unless each one is rewired to import `@mdi/js` path constants individually.
- `VSlider`/`VBtn` have global `defaults` configured once here rather than repeating props on every instance.
