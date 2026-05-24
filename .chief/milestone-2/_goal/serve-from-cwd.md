# Goal: Serve .vis.mdx from the current working directory

## Outcome

`vismd <file>.vis.mdx` serves the file with the operator's current working directory (`process.cwd()`) as the dev server's root. MDX authors write imports as real project-root-relative paths; vismd resolves them by mapping URL path to filesystem path under cwd, with safety containment.

The flow a user sees:

```
$ cd ~/my-project
$ vismd docs/intro.vis.mdx
vismd: working directory: /Users/thada/my-project
vismd: serving docs/intro.vis.mdx
http://127.0.0.1:5173
```

The MDX file at `docs/intro.vis.mdx` may write:

```mdx
import Hello from "{{VISMD_LOCAL}}/components/Hello"
<link rel="stylesheet" href="{{VISMD_LOCAL}}/styles/main.css" />
```

…and those resolve to `<cwd>/components/Hello.{tsx,ts,jsx,js}` and `<cwd>/styles/main.css` respectively.

## In scope

### 1. CLI: drop `--assets`

- The `--assets` flag is removed entirely. Passing it is an unknown-flag error.
- Remaining flags from milestone-1 carry over unchanged: `--port`, `--host`, `--no-open`.
- New behavior: at boot, vismd prints `vismd: working directory: <absolute path>` to stderr.

### 2. Strict `.vis.mdx` entry extension

- The entry file must end in `.vis.mdx`. Plain `.mdx` is rejected with a clear error suggesting rename: `vismd: error: file must end in .vis.mdx (got: <name>). Rename to <name without .mdx>.vis.mdx.`
- Basename for URL purposes strips the full `.vis.mdx` suffix (e.g., `intro.vis.mdx` → basename `intro` → `/_mdx/intro.mjs`).

### 3. MDX entry containment

- The entry file path must resolve to a location inside cwd. If outside → exit non-zero with `vismd: error: entry file <abs path> is outside working directory <cwd>`.
- Containment is checked via `realpath` to defeat symlink escape.

### 4. Working directory = `process.cwd()`, literal

- No find-up to `package.json`.
- No frontmatter parsing. The `vismd` namespace in MDX frontmatter is not recognized in milestone-2.
- Whatever cwd the process inherits (from the shell, or from a package manager rewrite like `pnpm exec`) is used as-is.

### 5. Real-path imports + unified asset dispatcher

- `{{VISMD_LOCAL}}/<any/path>.mjs` resolves to `<cwd>/<any/path>.{tsx,ts,jsx,js}` (first extension wins, in that order), then esbuild-transforms and serves as `text/javascript`.
- `{{VISMD_LOCAL}}/<any/path>.css` resolves to `<cwd>/<any/path>.css` and serves raw as `text/css`.
- A single dispatcher route handles all asset extensions; the per-extension behavior is data-driven (a handler table), not separate routes.

### 6. Containment on every asset request

- Browser request paths containing `..` segments are rejected at the route layer.
- After URL-to-disk resolution, `realpath` is computed and verified to start with the cwd absolute path. If not → 404.
- Containment violations return the same `404 Not Found` shape as legitimate misses (no `403`, no enforcement-layer leakage).
- Error body is terse: `Not found: <requested url>`. Absolute disk paths are never included in HTTP responses.

### 7. Placeholder substitution carries over

- `{{VISMD_LOCAL}}` and `{{VISMD_REGISTRY}}` substitution rules from milestone-1 are unchanged. Unknown placeholders still return `500` with `Unknown placeholder: {{X}}`.

## Out of scope (deferred)

- **Multi-file mode** (browsing many `.vis.mdx` files from one server, index page, navigation) — milestone-3.
- **Background daemon + client mode** (`vismd start`/`stop`/`status`, lock files, reuse running server) — milestone-4.
- **`--root` flag** — may be added later non-breakingly if a real use case appears.
- **Frontmatter hints** (`vismd: { ... }` in MDX frontmatter) — may be added later non-breakingly if needed.
- **`vismd doc` and `vismd check` commands** — still deferred (originally milestone-2 in spec-v1, now bumped further out).
- **HMR / watch / auto-reload** — still deferred.
- **CSS auto-injection** — still author-controlled via explicit `<link>` tags.
- **Additional asset extensions** (`.png`, `.svg`, `.woff2`, etc.) — the dispatcher is designed to allow them via a handler table, but milestone-2 ships only `.mjs` and `.css` handlers.

## Success criteria (verification gate)

A migrated fixture under `examples/` exists with this shape:

```
examples/
├── example.vis.mdx           # imports /components/Hello, links /styles/main.css
├── bad-placeholder.vis.mdx   # contains {{VISMD_FOO}} to exercise unknown-placeholder path
├── components/
│   └── Hello.tsx
└── styles/
    └── main.css
```

The verification gate has two parts.

### Agent-runnable smoke test

The smoke test script:
- Spawns `node ../dist/cli.js example.vis.mdx --port 5173 --no-open` with `cwd: examples/`.
- Asserts boot stderr contains a line matching `vismd: working directory: <abs path ending in /examples>`.
- `curl GET /` → 200, `text/html`, body references `/_mdx/example.mjs`.
- `curl GET /_mdx/example.mjs` → 200, `text/javascript`, body does not contain `{{VISMD_LOCAL}}`.
- `curl GET /components/Hello.mjs` → 200, `text/javascript`.
- `curl GET /styles/main.css` → 200, `text/css`.
- `curl GET /../etc/passwd` → 404, `text/plain`, body `Not found: /../etc/passwd` (or whatever the server normalizes the URL to before logging).
- Spawns a second server on `bad-placeholder.vis.mdx`, asserts `GET /_mdx/bad-placeholder.mjs` returns 500 with body `Unknown placeholder: {{VISMD_FOO}}`.
- Spawns with a plain `.mdx` arg (e.g., copy of fixture renamed) and asserts non-zero exit + stderr contains the `.vis.mdx` rename hint.
- Spawns with an MDX path outside cwd and asserts non-zero exit + stderr contains the containment error.
- Shuts each server down cleanly.

### Human-required browser check

A short doc (update `examples/MANUAL_CHECK.md`) tells the human to:
- `cd examples && vismd example.vis.mdx`
- Confirm the browser opens, the page renders, the Hello component is visible, and CSS from `styles/main.css` applied.

Milestone-2 is "done" when build passes, unit tests pass, and the agent-runnable smoke test passes. The browser check is the human's responsibility before any release tag.

## Note on placeholder contract

The `{{VISMD_LOCAL}}` / `{{VISMD_REGISTRY}}` contract from milestone-1 (`placeholder-contract.md`) is load-bearing and applies unchanged in milestone-2. Per the framework's milestone-isolation rule, it should be promoted to `.chief/_rules/_contract/` so it doesn't need to be duplicated per-milestone. That promotion is a separate housekeeping task and is not part of milestone-2's verification gate.
