# AGENTS.md

Bainpaint is a desktop app built on [tinyjs](https://tinyjs.app/) v0.63.0: a
txiki.js backend (v26.6.0 runtime) in one process, a plain HTML/CSS/JS frontend
rendered by the system webview. No Electron, no Node at runtime, no HTTP server,
no ports — the page and backend talk over an in-process bridge.

## Commands

```sh
tinyjs dev        # run with hot reload (frontend re-renders, backend restarts)
tinyjs build      # package a native app
tinyjs doctor     # diagnose install/project problems (read-only)

pnpm install                  # dev-only deps (tailwind, daisyui, lucide)
pnpm run build:ui             # re-vendor lucide + recompile tailwind.css
pnpm run vendor               # re-copy lucide only
pnpm run css                  # recompile tailwind.css only
pnpm run css:watch            # recompile on change
```

There is no lint/typecheck script. Syntax-check JS with `node --check <file>`.
Test backend code in the real runtime with the shipped txiki.js binary:

```sh
~/.tinyjs/bin/tjs run /tmp/probe.mjs   # `tjs` global is available inside
```

## Architecture

```
src/backend/main.js   backend entry. `export const api = {...}` + `init(app)`.
src/frontend/         plain files loaded by the webview (index.html, app.js, vendor/)
src/shared/           optional code imported by BOTH sides
types/                tiny.d.ts / tjs.d.ts editor types (from the scaffold)
tools/                UI build inputs (input.css, vendor.js) — not shipped
```

- Every `api` function is callable from the page: `await tiny.api.call('name', params)`.
  Handlers receive `(params, app)`; `app.push(event, payload)` reaches
  `tiny.api.on(event, fn)`. Expose named operations, not a generic `query(sql)`.
- `init(app)` runs once the window is up.
- The `tiny` global is injected into every page — no script tag for it.

### Hard boundaries (violating these throws)

- The frontend has **no** `tjs` — importing `tjs:*` or touching `tjs` in the
  page is a `ReferenceError`. Route everything through `api`.
- The backend has **no** DOM/window.
- `src/shared/` must be plain `.js` ES modules: no `tjs` imports, no secrets
  (it ships beside the frontend).
- Backend `tjs.*` fs calls are **async** — await them (e.g. `await tjs.makeDir`
  before opening a `tjs:sqlite` Database). `tjs:sqlite` itself is synchronous:
  statements have only `run()` / `all()` / `finalize()` (no `get()`; use
  `.all()[0]`).

## Vendored UI stack (no CDN, no runtime build)

`src/frontend/vendor/` is **committed**: `tailwind.css` (compiled, minified) and
`lucide.min.js` (UMD). To bump a library: edit `package.json` → `pnpm install` →
`pnpm run build:ui` → commit the vendor dir.

- Tailwind entry: `tools/input.css` (`@import "tailwindcss"`, `@source
  "../src/frontend"`, `@plugin "daisyui"`). Tailwind v4 — CSS-first config, no
  tailwind.config.js.
- daisyUI v5 theme list must be an **unquoted** comma list:
  `themes: dark --default, light;`. A quoted string or JS array silently drops
  themes (the handler only splits what Tailwind's parser hands it).
- Themes switch via `data-theme` on `<html>` (or any element). `--default`
  theme applies at `:root`; others only under their `data-theme` selector.
- lucide: put `<i data-lucide="name">` in markup, call `lucide.createIcons()`
  after DOM updates (including after swapping icons). Available icon names:
  `node_modules/lucide/dist/esm/icons/*.mjs`.

## Environment

- pnpm 12 works via a wrapper at `~/.local/bin/pnpm` (corepack cache; npm is
  **not** installed on this machine — use pnpm).
- txiki.js 26.6 exposes **no** platform string: `tjs.platform` /
  `tjs.hostPlatform` / `tjs.arch` do not exist (verified on the runtime).
  Frontend: `tiny.system.os()` → `'macos' | 'windows' | 'linux'`.
  Backend: use `tjs.system.userInfo`, `tjs.system.cpus`, `tjs.version`,
  `tjs.cwd`, `tjs.homeDir`, `tjs.hostName`, `tjs.pid`.
- Linux webview: do not route Web Audio graphs to `ctx.destination` (crackles).
  Play plain `<audio>` elements; analyze with `tiny.audioTap`; use
  `tiny.audio.sampler` for sound effects.
- `tinyjs.json` `id` is still the `com.example.bainpaint` placeholder — set a
  real reverse-domain id before building for distribution.

## Conventions

- Frontend: plain DOM + daisyUI classes + lucide; keep `esc()` for anything
  interpolated into `innerHTML`.
- Backend: small named `api` functions; keep `init(app)` for window-up side
  effects.
- After a tinyjs launcher update, run `tinyjs update-project` in this repo to
  refresh `types/` and the bundled agent skills.
