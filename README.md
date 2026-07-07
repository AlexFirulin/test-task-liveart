# Image Editor — Vue 3 Test Task

A browser-based, **non-destructive** image editor. The original file is never touched — every edit is stored as data (a small set of parameters), and both the live preview and the exported image are derived from `(original, parameters)` by the same rendering function.

**Live demo:** https://test-task-liveart.vercel.app/

> Full design write-up (op model, pipeline order, Safari fallback, trade-offs): [`NOTES.md`](./NOTES.md)

## Quick start

```bash
npm i && npm run dev   # dev server
npm test               # 63 unit tests (vitest)
npm run build          # type-check (vue-tsc) + production build
```

**Stack:** Vue 3 · Vuetify 3 · Pinia · TypeScript · vue-advanced-cropper · Vitest

## Features

Everything from the brief, both bonus items, and a few things beyond it:

| | |
|---|---|
| **Required** | Upload (click or drag-and-drop, multiple files) · interactive crop · brightness / contrast / saturation sliders — draggable **and** as exact-value number inputs — with real-time preview · reset (whole image, or double-click a slider label to reset just that one) · export |
| **Bonus** | 6 filter presets (greyscale, sepia, invert, warm, cool, vintage) · JSON export of the applied operations |
| **Beyond the brief** | Rotate ±90° and flip H/V · **undo/redo** (buttons + Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z) · JSON **import** (replay a recipe onto the original) · multi-image list, each with its own independent edit pipeline · exports as JPEG (quality 0.92) when the source was a JPEG, PNG otherwise · duplicate filenames get a short unique suffix so downloads never overwrite each other · non-blocking upload warnings above 25MB or 40MP · loading states on preload/download/export so nothing looks unresponsive or double-fires · Safari < 18 export fallback |

## How edits are modeled

Each image holds four slots, applied in a fixed order:

```
transform (rotate/flip) → crop → adjust (B/C/S) → filter
```

- Moving a slider mutates the current slot's params — there is no growing history of raw pixel snapshots, and **Reset** just returns the four slots to their neutral defaults.
- `toOperations()` derives a serializable `Operation[]` from those slots. The **same pure function** feeds the live preview, the image export, and the JSON export, so they cannot drift apart.
- One render function — `drawPipeline()` in [`src/utils/render.ts`](./src/utils/render.ts) — draws thumbnails, the preview, and the exported file. Crop never cuts pixels; it is only ever a source-rect for `drawImage`.
- Rotation is restricted to 0/90/180/270 on purpose: it keeps the crop rectangle axis-aligned, so a crop stays representable as a plain source-rect after any transform (rationale in [`NOTES.md`](./NOTES.md)).

### Exported JSON shape

```json
{
  "version": 1,
  "operations": [
    { "type": "transform", "rotate": 90, "flipX": false, "flipY": true },
    { "type": "crop", "left": 120, "top": 40, "width": 800, "height": 600 },
    { "type": "adjust", "brightness": 120, "contrast": 95, "saturation": 110 },
    { "type": "filter", "name": "vintage" }
  ]
}
```

Only non-neutral slots are included; replaying the array against the original image in order reproduces the exported image exactly.

**Import is strict, not lenient.** `parseOperationsFile()` validates every field (unknown op types, out-of-range rotation, duplicate ops, wrong `version` all throw a specific error), then performs a **round-trip assertion**: the parsed result is re-serialized through the same `toOperations()` and must match the input byte-for-byte. This catches inputs that are field-valid but structurally wrong (wrong op order, explicit no-ops) — a class of errors per-field checks alone would miss.

## Preview = export, on every browser

Adjustments and filters are one CSS filter string (`toCssFilter()`):

- **While editing** it is applied as a GPU-accelerated `style="filter: …"` — sliders stay instant, no per-frame pixel loop.
- **For thumbnails and export** the same string is baked into pixels via `ctx.filter` inside `drawPipeline()`.

**Safari < 18 caveat:** `ctx.filter` there is a *silent no-op* — the assignment doesn't throw, it's just ignored, which would export an unfiltered image while the preview shows a filtered one. The app feature-detects this once (round-tripping a test value through `ctx.filter`) and falls back to a manual per-pixel implementation using the brightness/contrast/saturate matrices from the CSS Filter Effects spec, so the fallback output matches the CSS preview.

That manual fallback is a single per-pixel loop, which would otherwise block the main thread for seconds on a large photo. Above ~4 megapixels it processes 200 rows at a time with a `requestAnimationFrame` yield between chunks, so the tab stays responsive; smaller canvases still run in one synchronous pass, since chunking would only add a wasted frame.

Filter presets deliberately avoid `blur()` and other absolute-pixel functions: a fixed pixel radius isn't scale-invariant, so it would render differently on a downscaled thumbnail than in the full-resolution export — breaking the preview = export guarantee everything else is built around.

## Upload guardrails & loading states

- **Uploader.vue** warns — but never blocks — when a file is over 25MB, or when its decoded pixel count (`naturalWidth * naturalHeight`) is over 40MP; both checks run per file before the upload proceeds, so a large photo is still usable, just flagged.
- **EditorPanel** shows a spinner in the preview area while the next image is preloading (`App.vue#openEditor`), instead of leaving the previous image sitting there or a blank placeholder.
- **List.vue**'s download and JSON-export buttons track their own per-item loading state (`:loading`/`:disabled`, cleared in `finally`) so a slow export can't be double-triggered by an impatient click, and always finishes cleanly even if it throws.

## Undo/redo

Extends the same four-slot model instead of adding pixel snapshots: a history step is just `{ transform, crop, adjustments, filter }` — the same shape as the JSON-export payload, tens of bytes, capped at 50 steps (`src/composables/useEditHistory.ts`). Discrete-action boundaries come from native events where they exist (a slider's drag-release, a text field's blur/Enter, a filter chip click); crop drag/resize and rotate/flip — which `vue-advanced-cropper` reports through one continuous `change` event with no release signal — are debounced instead (`src/utils/debounce.ts`, 400ms). Reset and re-importing JSON onto the image currently open are both themselves undoable steps, not history resets. Full rationale, including the cost comparison against a baked-pixel-snapshot approach, in [`NOTES.md`](./NOTES.md#undoredo).

## Tests

63 unit tests (`npm test`, in a top-level `tests/` folder mirroring `src/`) covering:

- the Pinia store (add/remove, per-field setters, `applyOperations`, reset)
- `toOperations` / `fromOperations` inversion and `parseOperationsFile` rejection cases
- transform math (`normalizeRotation`, `rotatedDimensions`, neutrality checks)
- the CSS filter string builder and the manual pixel fallback (brightness, greyscale, alpha preservation, and the row-chunked path for large canvases)
- `drawPipeline` itself — a stubbed `OffscreenCanvas` records every draw/transform call to verify the crop-as-source-rect, rotate/flip-via-intermediate-canvas, and filter-supported vs. pixel-fallback branches without needing a real browser canvas
- the undo/redo stack (`useEditHistory`: push/undo/redo sequencing, no-ops at either end, redo-tail clearing, the step cap) and the debounce utility it pairs with for the crop/rotate path
- `useCropperBridge`'s reset-vs-apply branching and its `isUserInitiated` guard, against a fake cropper-instance object rather than a mounted component

## Project structure

```
src/
├── types/                  # shared domain model: Adjustments, Transform, Crop, Operation, ImageItem
├── stores/images.ts        # ImageItem[] — the four edit slots per image
├── utils/
│   ├── render.ts           # drawPipeline: the single render path (preview + export)
│   ├── operations.ts       # toOperations / fromOperations / parseOperationsFile
│   ├── filters.ts          # toCssFilter + Safari pixel fallback (chunked for large canvases)
│   ├── transform.ts        # rotation/flip math
│   ├── export.ts           # PNG/JPEG + JSON download
│   └── debounce.ts         # generic trailing debounce (crop/rotate history commit)
├── components/
│   ├── Image/              # Uploader, List, EditorPanel, Cropper, Preview
│   └── Filters/            # adjustment sliders, filter chips
└── composables/
    ├── useImageDropZone.ts   # shared drag-and-drop plumbing
    ├── useEditHistory.ts     # generic undo/redo stack
    ├── useCropperBridge.ts   # the only thing that talks to Cropper.vue's template ref
    └── useUndoRedoKeyboard.ts

tests/                      # mirrors src/'s shape — tests/utils, tests/stores, tests/composables
```

`Cropper.vue` is the only file that imports `vue-advanced-cropper` — the rest of the app works with our own `Crop`/`Transform` types (`src/types/`), so the domain model stays library-agnostic.

## Original brief

<details>
<summary>
    Requirements checklist (all done, incl. both bonus items)
</summary>

- [x] Load an image via file upload
- [x] Crop uploaded image
- [x] Live sliders with real-time preview: brightness, contrast, saturation
- [x] Reset / view original; edits stay non-destructive
- [x] Export the result by downloading it
- [x] **Bonus:** at least one filter (six shipped)
- [x] **Bonus:** export operations as JSON such that replaying them on the original reproduces the result (import/replay is implemented too)

</details>