# Bainpaint

Greenfield desktop app built on [tinyjs](https://tinyjs.app/): a txiki.js backend
plus a system-webview frontend, ~5 MB shipped, no Electron, no Node, no ports.

## Stack

- **tinyjs** — app framework (backend + webview launcher), see `tinyjs.json`
- **Tailwind CSS 4.3.3** + **daisyUI 5.7.50** — UI, vendored
- **lucide 1.62.0** — icons, vendored

The UI has no CDN and no runtime build step. `src/frontend/vendor/` (compiled
`tailwind.css` and `lucide.min.js`) is committed to the repo.

## Run

```sh
tinyjs dev      # hot reload
tinyjs build    # package a native app
```

Requires the [tinyjs launcher](https://tinyjs.app/) (`curl -fsSL https://tinyjs.app/install | sh`).

## Layout

```
tinyjs.json            # app manifest (name, id, size, version)
assets/icon.png        # 1024x1024 app icon
src/backend/main.js    # backend entry — export const api, init(app)
src/frontend/          # plain HTML/CSS/JS rendered by the system webview
  index.html
  app.js
  vendor/              # vendored UI assets (committed)
    tailwind.css       # compiled from tools/input.css
    lucide.min.js      # copied from node_modules/lucide
src/shared/            # (optional) code imported by both sides
tools/input.css        # Tailwind v4 + daisyUI source
tools/vendor.js        # re-copies lucide from node_modules
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

## Notes

- `tinyjs.json` `id` is still the scaffold placeholder `com.example.bainpaint` —
  set a real reverse-domain id before building for distribution.

## License

[MIT](LICENSE)
