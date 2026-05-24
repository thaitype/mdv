# Goal: Serve MDX in the browser

> Hint references (not required reading): `draft/spec-v1.md`, `draft/spec-phase-1.md`.
> This goal file is self-contained; do not depend on draft/ for milestone execution.

## Outcome

`mdv <file>.mdx` boots a local HTTP server that compiles and renders the given MDX file in the browser, on-the-fly, with no build step.

A user running `npx @thaitype/mdv example.mdx` from a fresh checkout sees the rendered MDX in their default browser within seconds. The MDX may import local `.tsx`/`.ts`/`.jsx`/`.js` components from an adjacent assets directory; those components compile and load as native ESM modules in the browser.

## In scope

- Single command surface: `mdv <file>.mdx [flags]` (the default/serve command).
- Flags:
  - `--assets <dir>` (default `./components`) — directory served as ESM + static assets.
  - `--port <n>` (default `0`, auto-pick).
  - `--host <h>` (default `127.0.0.1`).
  - `--no-open` — suppress auto-open.
- HTTP routes:
  - `GET /` → HTML shell that boots the MDX entry.
  - `GET /_mdx/<name>.mjs` → compiled MDX as ESM (with placeholders substituted).
  - `GET /<component>.mjs` → esbuild-transformed `.tsx`/`.ts`/`.jsx`/`.js` from `--assets`.
  - `GET /<file>.css` → static CSS from `--assets`.
- MDX compile via `@mdx-js/mdx` `compile()` with `outputFormat: "program"`, `jsxImportSource: "react"`, `development: true`.
- Component compile via in-process `esbuild.transform` (no bundling, no plugins).
- React in the browser is loaded from `esm.sh` (no local React shipped).
- Browser auto-opens on boot unless `--no-open` is passed.

## Out of scope (do not implement in milestone-1)

- `mdv doc` command — deferred to milestone-2.
- `mdv check` command — deferred to milestone-2.
- HMR — no chokidar watch, no WebSocket, no auto-reload. The user reloads the browser manually.
- CSS auto-inject — mdv does not scan `--assets` for `.css` files or inject `<link>` tags. CSS is referenced explicitly from MDX (see `placeholder-contract.md`).
- Bundling, static export, `mdv build`.
- Registry HTTP interaction from mdv itself. The browser may fetch a registry component directly via a substituted URL, but mdv does not proxy or validate registry content.
- Type-checking of component props.
- Multi-file, glob, or watch modes.
- Vue / Preact / Solid (React only).

## Success criteria (verification gate)

A fixture exists under `examples/` (or equivalent) containing:
1. One `.mdx` file that imports at least one local component via `{{MDV_LOCAL}}/Component`.
2. The component is a `.tsx` file in the assets directory.
3. The MDX file contains an explicit `<link rel="stylesheet" href="{{MDV_LOCAL}}/styles.css" />` referencing a sibling `.css` file.
4. The MDX file contains plain markdown text and one JSX element using the imported component.

The verification gate has two parts:

### Agent-runnable smoke test

A script (or documented sequence) that:
- Boots the server on a known port.
- `curl`s `GET /` and asserts a 200 with HTML content-type and that the response contains a `<script type="module">` block referencing `/_mdx/<entry>.mjs`.
- `curl`s `GET /_mdx/<entry>.mjs` and asserts a 200 with `text/javascript` content-type and that `{{MDV_LOCAL}}` is no longer present in the body (substitution happened).
- `curl`s `GET /<Component>.mjs` and asserts a 200 with `text/javascript`.
- `curl`s `GET /styles.css` and asserts a 200 with CSS content-type.
- Boots a second fixture MDX containing `{{MDV_FOO}}` and asserts the relevant route returns 500 with body `Unknown placeholder: {{MDV_FOO}}`.
- Shuts the server down cleanly.

### Human-required browser check (documented in README/examples)

A short doc telling the human to:
- Run `mdv example.mdx`.
- Confirm the browser opens automatically.
- Confirm the rendered page shows: the markdown text, the component-rendered output, and visual evidence the CSS applied.

The agent declares milestone-1 done only when the smoke test passes. The browser check is the human's responsibility before any release tag.
