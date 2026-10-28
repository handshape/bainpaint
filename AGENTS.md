# AGENTS.md

Bainpaint is a MS-Paint-class desktop paint app built on [tinyjs](https://tinyjs.app/) v0.67.1:
a txiki.js backend (v26.6.0 runtime) in one process, a plain HTML/CSS/JS frontend
rendered by the system webview. No Electron, no Node at runtime, no HTTP server,
no ports — the page and backend talk over an in-process bridge.

## Commands

```sh
tinyjs dev        # run with hot reload (frontend re-renders, backend restarts)
tinyjs build      # package a native app → dist/
tinyjs doctor     # diagnose install/project problems (read-only)

pnpm install                  # dev-only deps (tailwind, daisyui, lucide)
pnpm run test                 # run the full test suite (node --test + tjs)
pnpm run build:ui             # re-vendor lucide + recompile tailwind.css
pnpm run vendor               # re-copy lucide only
pnpm run css                  # recompile tailwind.css only
pnpm run css:watch            # recompile on change
```

There is no lint/typecheck script. Syntax-check JS with `node --check <file>`.

## Testing

```sh
pnpm run test
```

| File | Runner | Covers |
|---|---|---|
| `test/lib.test.js` | `node --test` | BPLib pure functions: budget, flood fill, BMP encoder, resample, effects, palette |
| `test/b64.test.js` | `node --test` | base64 decoder: vectors, 256-byte + 1 MB roundtrip, whitespace, URL-safe |
| `test/save.test.mjs` | `tjs run` | chunked `saveImage`/autosave backend path (>1 MB byte-identical) |

The tjs test requires the txiki.js runtime: `~/.tinyjs/bin/tjs run test/save.test.mjs`.

## Architecture

```
src/backend/
  main.js               backend entry. `export const api = {...}` + `init(app)`.
  b64.js                pure-JS base64 decoder (txiki.js has no tjs:base64).
src/frontend/           classic scripts on window.BP (NOT ES modules)
  index.html            shell + <script> load order (the module graph)
  app.js                boot, native menu, shortcut registry (loads last)
  print.html            throwaway print/PDF window
  lib/                  pure, DOM-free algorithms → globalThis.BPLib
    budget.js           undo-budget eviction math
    floodfill.js        scanline flood fill (RGBA buffer)
    bmp-enc.js          24-bit BMP encoder
    resample.js         nearest + bilinear resample
    effects.js          brightness, negative, blur, sharpen
    palette.js          28-swatch classic Windows-Paint palette
  modules/              BP.* modules (classic scripts, no import/export)
    bus.js              window.BP namespace + event emitter (loads first)
    document.js         Doc model: {w,h,canvas,ctx,path,name,modified,version}
    view.js             viewport state {zoom,panX,panY}; CSS transform on stage
    undo.js             region-snapshot stack, budget eviction, undo/redo
    pointer.js          pointer capture, doc coords, pan, ctrl+wheel zoom
    commands.js         command registry {id: {run, enabled(ctx)}}
    colors.js           {primary, secondary}, swap, recent colors
    selection.js        selection state (rect/color), marching-ants renderer
    clipboard.js        internal clipboard + tiny.clipboard read/write
    files.js            new/open/save/save-as/recent/drag-drop/autosave
    effects.js          DOM wrapper for lib/effects.js (undo entries)
    imageops.js         rotate, flip, resize (canvas ops)
    sfx.js              tiny.audio.sampler wrapper + mute state
    formats/decode.js   fileURL → Image → Doc (4096 cap)
    formats/bmp.js      canvas → lib/bmp-enc.js → ArrayBuffer
    tools/              tool registry + 14 tool implementations
    ui/                 toolbar, optionsbar, palette, statusbar, dialogs
resources/sfx/          committed synthesized sound-effect WAV clips
test/                   test suite (see Testing)
tools/                  UI build inputs + legacy probes (not shipped)
types/                  tiny.d.ts / tjs.d.ts editor types
```

- Every `api` function is callable from the page: `await tiny.api.call('name', params)`.
  Handlers receive `(params, app)`; `app.push(event, payload)` reaches
  `tiny.api.on(event, fn)`. Expose named operations, not a generic `query(sql)`.
- `init(app)` runs once the window is up.
- The `tiny` global is injected into every page — no script tag for it.

### Frontend module loading (platform-forced)

Built apps serve the page from `file://` on all three OSes. Chromium/WebView2
**blocks ES-module scripts from `file://`** (opaque-origin CORS). The page
therefore uses **classic `<script>` files with a shared global namespace**:

- `index.html` lists every script in load order (libs → modules → `app.js`);
  that order *is* the module graph.
- Every frontend file is a classic script (no `import`/`export`) attaching to
  `window.BP` (e.g. `BP.tools.pencil = {...}`); `app.js` boots last.
- Pure, DOM-free algorithms in `lib/` assign into `globalThis.BPLib` and never
  touch `window`/DOM, so they can be unit-tested in Node and probed in tjs.
- `src/shared/` is unused (page code can't be ESM-imported in builds).

### Hard boundaries (violating these throws)

- The frontend has **no** `tjs` — importing `tjs:*` or touching `tjs` in the
  page is a `ReferenceError`. Route everything through `api`.
- The backend has **no** DOM/window.
- Backend `tjs.*` fs calls are **async** — await them. `tjs:sqlite` is
  synchronous: statements have only `run()` / `all()` / `finalize()`.

### Core contracts

**Stage rendering** — the document canvas element (`#doc-canvas`) is the
visible canvas: zoom/pan are pure CSS transforms. A viewport-sized overlay
canvas (`#overlay`) hosts shape ghosts, marching ants, and the text editing
box. Tools draw directly to `doc.ctx` in document coordinates.

**Doc** — `document.js`: `createDoc(w, h, {fill})` → Doc; `setCanvasSize`,
`resizeImage`. `setDoc(doc)` adopts the doc's canvas buffer into the visible
`#doc-canvas` element.

**Undo** — region-snapshot entries (`{x,y,w,h,ImageData}` lists). Freehand
strokes capture incrementally via `beginStroke` → `cover` → `commit`. One-shot
ops call `snapshotRegion` before drawing. Budget: 128 MB, ≥10 levels, hard
floor 4.

**Pointer** — owns all pointer input on the stage. Delivers `{x, y,
secondary, e}` to the active tool. Space/middle-drag pans; ctrl+wheel zooms.

**Tool contract** — `{ id, name, icon, hotkey?, options, down, move, up,
preview?, cancel? }`. Freehand: `beginStroke` → `cover` per sample →
`commit`. Shapes: rubber-band ghost on overlay, single commit on up.

**Commands** — `commands.js`: `run(id, arg?)`. Toolbar, native menu, and
shortcuts all map to command ids — one dispatch path.

**File I/O** — Save: `canvas.toBlob` or BMP encoder → base64, chunked ≤ 512 KB
per message → `api.call('saveImage', {path, b64, i, n})`. Open: `tiny.fileURL`
+ `<img>` (no bytes on the wire). Autosave: debounced, chunked, recovery dialog
at boot.

## Vendored UI stack (no CDN, no runtime build)

`src/frontend/vendor/` is **committed**: `tailwind.css` (compiled, minified) and
`lucide.min.js` (UMD). To bump a library: edit `package.json` → `pnpm install` →
`pnpm run build:ui` → commit the vendor dir.

- Tailwind entry: `tools/input.css` (Tailwind v4 — CSS-first config, no
  tailwind.config.js).
- daisyUI v5 theme list must be an **unquoted** comma list:
  `themes: dark --default, light;`.
- Themes switch via `data-theme` on `<html>`.
- lucide: `<i data-lucide="name">` + `lucide.createIcons()` after DOM updates.

## Environment

- pnpm works via a wrapper at `~/.local/bin/pnpm` (npm is **not** installed).
- txiki.js 26.6 exposes **no** platform string. Frontend: `tiny.system.os()`.
  Backend: `tjs.system.userInfo`, `tjs.system.cpus`, `tjs.version`, etc.
- Linux webview: do not route Web Audio graphs to `ctx.destination` (crackles).
  Use `tiny.audio.sampler` for sound effects only.
- App id: `com.handshape.bainpaint` (set in `tinyjs.json`).
- The `tinyjs` wrapper at `~/.local/bin/tinyjs` strips snap-injected GSettings
  env vars so WebKitGTK finds the system xsettings schema.

## Conventions

- Frontend: classic scripts on `window.BP`; plain DOM + daisyUI + lucide;
  keep `BP.esc()` for anything interpolated into `innerHTML`.
- Backend: small named `api` functions; keep `init(app)` for window-up side
  effects.
- Pure algorithms go in `lib/` (→ `globalThis.BPLib`), DOM-free, testable in
  Node and tjs.
- After a tinyjs launcher update, run `tinyjs update-project` to refresh
  `types/` and the bundled agent skills.
