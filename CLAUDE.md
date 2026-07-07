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
  - `cropCoordinates: Coordinates | null` — from `vue-advanced-cropper`, in the original image's coordinate space. Crop never actually cuts pixels; it's only ever used later as the source-rect argument to `drawImage`.
  - `adjustments: { brightness, contrast, saturation }` — a fixed slot, mutated in place by the sliders (not appended to a list).
  - `filter: FilterName | null` — a single nullable slot (`'greyscale' | 'sepia'`), so only one filter can be active at a time by construction.
  - `resetEdits`/`Reset` just nulls these three slots back to defaults — the original file is untouched throughout.
- **`src/utils/filters.ts#toCssFilter(adjustments, filter)`**: builds one canonical CSS filter string (`brightness() contrast() saturate() [grayscale()|sepia()]`). This exact string drives both the live preview (as a CSS `style.filter`, free/GPU-accelerated, no pixel loop) and, at export time, `ctx.filter` on the canvas — one function, so preview and export can never drift apart.
- **`src/utils/operations.ts#toOperations(...)`**: derives a serializable, tagged `Operation[]` (`{type: 'crop'|'adjust'|'filter', ...}`) from the same store state, using the same "only include non-neutral slots" logic. This is what gets JSON-exported (the bonus requirement) and is what a replay would run against the original image.
- **`src/utils/export.ts`**: `downloadImage` renders via `OffscreenCanvas` + `ctx.filter` + `convertToBlob` (bakes pixels only here, never during preview); `downloadOperationsJson` serializes `{version, operations}` via `toOperations`.
- **`src/components/Image/Preview.vue`**: the shared preview renderer — draws the crop as a source-rect onto a `<canvas>` (geometry only, no filter baked into pixels) and applies the CSS filter as a style, so it's reused unmodified for both list thumbnails and the full-size preview.

When extending the edit model (e.g. adding a new adjustment or filter), keep the same shape: add a field to `ImageItem`, extend `toCssFilter`/`toOperations` together so preview/export/JSON stay in sync, and don't introduce per-edit mutation of pixel data.

## Component / data flow

- **`App.vue`** is the orchestrator: owns transient UI state (`editingId`, `editorOpen`, `isNewUpload`) and wires `useImagesStore` to the dialog. It does not hold any editing state itself.
- **`src/components/Image/Uploader.vue`** is a generic icon-button + hidden `<input type="file">`; it doesn't know about the store. Used both as the main "add image" control and (with `icon`/`size` props) inline elsewhere.
- **`src/components/Image/List.vue`** renders one row per `ImageItem` (thumbnail via `Preview.vue`, edit/download/JSON/delete actions). Uploading a new image auto-opens the editor for it.
- **`src/components/Image/EditorDialog.vue`** holds *draft* copies of crop/adjustments/filter — nothing is written back to the store until **Apply**. **Cancel** discards the draft; if the image being edited was just uploaded and never applied before (`isNewUpload`), Cancel also removes it from the store entirely — but canceling a re-edit of an already-applied image only discards the draft, it does not delete the image. This distinction lives in `App.vue#cancelEdit`, not in the dialog.
- **`src/components/Image/Cropper.vue`** is a thin wrapper around `vue-advanced-cropper`'s `Cropper`, exposing `reset()` and emitting `change` with raw `Coordinates` — it holds no store knowledge.
- **`src/components/Filters/AdjustmentsPanel.vue`** / **`src/components/Filters/FilterPanel.vue`** are controlled, store-agnostic `v-model` components (three sliders; two mutually-exclusive checkboxes since the store's `filter` slot is single-valued).
- **Perceived-latency detail**: `EditorDialog.vue`'s `v-dialog` is `eager`, so the crop tool's mount timing is driven purely by `ImageCropper`'s own `v-if="src"` (`src` is bound straight from `App.vue`'s `editingImage`, which updates as soon as `editingId` is set) — it mounts and `src/utils/preload.ts#preloadImage` finishes decoding *before* `editorOpen` flips true, independent of the draft-seeding watcher below. Don't gate that `v-if` on anything derived from the seeding watcher, or the open transition will show a blank/loading crop tool again.
- **Draft-seeding watcher**: watches `modelValue` (open transition `false -> true`), not `src` — re-seeding on `src` alone broke re-editing the same image after Cancel (draft stayed at the discarded values since `src` never changed on reopen). On open it also calls `cropperRef.reset()` when `initialCrop` is `null`, since the eager dialog keeps the cropper's internal visual selection across opens and it otherwise wouldn't revert to match the stored (uncropped) state.

## Vuetify configuration (`src/plugins/vuetify.ts`)

- Dark theme is the default — this is a deliberate, domain-informed choice (matches how professional image/print editors default to dark chrome so it doesn't bias brightness/contrast/saturation perception), not a stylistic default. See `NOTES.md` for the full rationale.
- Icons use the **font-based** `vuetify/iconsets/mdi` (+ `@mdi/font`), not `vuetify/iconsets/mdi-svg`. This was a deliberate fix: `mdi-svg` only ships path data for Vuetify's own internal aliases (close, checkbox, etc.), not arbitrary `mdi-*` names like `mdi-crop`/`mdi-pencil`/`mdi-download` used throughout this app — switching iconsets would silently blank out every icon button unless each one is rewired to import `@mdi/js` path constants individually.
- `VSlider`/`VBtn` have global `defaults` configured once here rather than repeating props on every instance.
