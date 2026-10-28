# Bainpaint

A MS-Paint-class desktop paint app built on [tinyjs](https://tinyjs.app/): a
txiki.js backend plus a system-webview frontend, ~5 MB shipped, no Electron, no
Node, no ports.

## Features

**Tools** — pencil, brush (1–100 px), eraser (paints the background color,
classic-Paint style), spray, fill bucket (scanline flood fill with tolerance),
line, curve, rectangle, ellipse, polygon (fill/outline options), text
(8 fonts, 8–200 px), eyedropper, magnifier, and rectangular selection with
marching ants.

**Colors** — 28-swatch classic Windows-Paint palette, primary/secondary color
model (right-drag paints secondary, `X` swaps), custom color picker (HSL/RGB),
and 10 recent colors (persisted).

**Selection & clipboard** — select all / deselect, select by color (tolerance),
drag-move a selection's content, cut/copy/paste/delete; internal clipboard plus
the native OS clipboard (paste external images).

**Image ops** — new document (presets + custom, 4096×4096 cap), resize canvas
(crop/expand + anchor + fill), resize image (nearest/bilinear, aspect lock),
rotate 90°/180°, flip H/V, brightness, negative, blur, sharpen.

**Files** — PNG/JPEG/BMP save (BMP via an in-page encoder), PNG/JPEG/BMP/GIF
open (GIF = first frame), recent files, drag-drop open, autosave with
crash-recovery dialog.

**View & polish** — zoom 25–800% (ctrl+wheel at cursor, fit, 100%), space/middle
drag pan, native menu bar (File/Edit/Image/View/Help) + toolbar + status bar,
keyboard shortcuts throughout, dark/light themes, subtle paint sound effects,
print / PDF export, screenshot-to-canvas.

**Undo/redo** — region-snapshot undo with a 128 MB budget (≥10 levels for
normal strokes, hard floor 4).

## Stack

- **tinyjs** — app framework (backend + webview launcher), see `tinyjs.json`
- **Tailwind CSS 4.3.3** + **daisyUI 5.7.50** — UI, vendored
- **lucide 1.62.0** — icons, vendored

The UI has no CDN and no runtime build step. `src/frontend/vendor/` (compiled
`tailwind.css` and `lucide.min.js`) is committed to the repo.

## Prerequisites

- [tinyjs](https://tinyjs.app/) launcher (`curl -fsSL https://tinyjs.app/install | sh`)
- [pnpm](https://pnpm.io/) (dev-only: Tailwind, daisyUI, lucide)
- Node.js ≥ 20 (for `node --test` and `node --check`)

## Develop

```sh
pnpm install        # dev-only deps (tailwind, daisyui, lucide)
tinyjs dev          # run with hot reload
pnpm run test       # run the test suite
```

## Build

```sh
tinyjs build        # compile backend + package native app → dist/
./dist/bainpaint    # launch the packaged app (Linux)
```

The build produces a self-contained binary (`dist/bainpaint`) plus its
launcher, icon, and resources. No Node, no runtime dependencies — the
packaged app is ~5 MB.

To rebuild UI assets after editing `tools/input.css` or bumping a library
version:

```sh
pnpm run build:ui   # re-vendor lucide + recompile tailwind.css
```

Then commit `src/frontend/vendor/`.

## Layout

```
tinyjs.json            # app manifest (name, id, size, version)
assets/icon.png        # 1024x1024 app icon
resources/sfx/         # committed synthesized sound-effect clips
src/backend/
  main.js              # backend entry — export const api, init(app)
  b64.js               # pure-JS base64 decoder (txiki.js has no tjs:base64)
src/frontend/          # classic scripts on window.BP (no ES modules — builds
                       # load the page from file://, where module scripts are blocked)
  index.html           # shell + <script> load order (the module graph)
  app.js               # boot, native menu, shortcut registry
  print.html           # throwaway print/PDF window
  lib/                 # pure, DOM-free algorithms (BPLib), tjs-probeable
    budget.js floodfill.js bmp-enc.js resample.js effects.js palette.js
  modules/             # BP.* modules: document, view, undo, pointer, commands,
                       # colors, selection, clipboard, files, effects, imageops,
                       # sfx, formats/, tools/, ui/
  vendor/              # vendored UI assets (committed)
    tailwind.css       # compiled from tools/input.css
    lucide.min.js      # copied from node_modules/lucide
test/
  lib.test.js          # unit tests for BPLib pure functions (node --test)
  b64.test.js          # unit tests for base64 decoder (node --test)
  save.test.mjs        # integration test for chunked save (tjs run)
tools/input.css        # Tailwind v4 + daisyUI source
tools/vendor.js        # re-copies lucide from node_modules
tools/makesfx.js       # one-shot generator for resources/sfx (dev-only)
tools/probes/          # legacy tjs probes (superseded by test/)
types/                 # tiny.d.ts / tjs.d.ts for editors
```

## UI assets

Dev-only dependencies (pnpm):

```sh
pnpm install
pnpm run build:ui     # vendor lucide + recompile tailwind.css (minified)
pnpm run css:watch    # recompile on change (needs @parcel/watcher build)
```

To bump a UI library: change its version in `package.json`, `pnpm install`,
then `pnpm run build:ui` and commit `src/frontend/vendor/`.

- daisyUI themes are set in `tools/input.css` (`@plugin "daisyui" { themes: ... }`);
  the page toggles via `data-theme` on `<html>`.
- lucide icons render with `lucide.createIcons()` over `<i data-lucide="...">`.

## Testing

```sh
pnpm run test
```

Runs the full suite: Node-based unit tests (`node --test`) for pure BPLib
algorithms and the base64 decoder, plus a tjs integration test for the
chunked `saveImage`/autosave backend path (requires the txiki.js runtime).

| File | Runner | Covers |
|---|---|---|
| `test/lib.test.js` | `node --test` | budget eviction, flood fill (exact/tolerance/visited), BMP encoder (header/BGR/padding), resample (nearest/bilinear), effects (brightness/negative/blur/sharpen), palette invariants |
| `test/b64.test.js` | `node --test` | known vectors, all-256-byte roundtrip, 1 MB roundtrip, whitespace, URL-safe |
| `test/save.test.mjs` | `tjs run` | chunked `saveImage` (>1 MB byte-identical), `.part` cleanup, autosave save/load/clear |

Legacy probes under `tools/probes/` still work standalone (`~/.tinyjs/bin/tjs
run tools/probes/<name>.mjs`) but are superseded by the test suite.

Every JS file is syntax-checked with `node --check`; there is no lint/typecheck
script.

## Notes

- App id: `com.handshape.bainpaint` (reverse-domain of handshape.com).
- Animated GIFs import only their first frame (accepted limitation).
- Sound effects use `tiny.audio.sampler` only; the Web Audio graph is never
  routed to the destination (Linux webview crackles).
- The `tinyjs` wrapper at `~/.local/bin/tinyjs` strips snap-injected GSettings
  env vars (`GSETTINGS_SCHEMA_DIR`, snap `XDG_DATA_DIRS` entries) so WebKitGTK
  finds the system xsettings schema. Plain terminals are unaffected.

## License

[MIT](LICENSE)
