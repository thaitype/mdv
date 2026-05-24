# @vismd/cli — Design Spec

**Status:** Draft v0.2 (MVP-focused)
**Author:** Thada (mildronize)
**Last updated:** 2026-05-24

## 1. Purpose

`vismd` is a CLI that previews `.mdx` files in the browser by serving a separate `components/` directory as ESM over HTTP. MDX files import components via full URLs containing `{{VISMD_LOCAL}}` / `{{VISMD_REGISTRY}}` placeholders that `vismd` substitutes at serve time, so AI-generated MDX is portable across machines without filesystem coupling.

It exists to close the gap between Thariq Shihipar's HTML-as-AI-output approach (zero toolchain, expensive in tokens, inconsistent) and Markdown (cheap, no visual primitives). The AI emits short MDX referencing a shared component vocabulary, output tokens drop, visual consistency rises.

## 2. Non-goals (v0.1 MVP)

- Not a documentation site generator
- Not a build/static export tool — `vismd build` is a next-phase feature
- Not a component library — components are user-supplied; `vismd` ships zero
- React only at MVP (no Vue, Preact, Solid)
- No registry override, no discovery, no multi-file mode

## 3. Commands

### 3.1 `vismd <file>.mdx [flags]` — serve mode

Default command. Compiles and serves the MDX file in the browser.

```bash
vismd architecture.mdx
vismd architecture.mdx --assets ./components
vismd architecture.mdx --port 5173
vismd architecture.mdx --no-open
```

| Flag | Default | Purpose |
|---|---|---|
| `--assets <dir>` | `./components` | Directory served as ESM assets |
| `--port <n>` | `0` (auto) | Server port |
| `--no-open` | false | Don't auto-open browser |
| `--host <h>` | `127.0.0.1` | Bind host |

### 3.2 `vismd doc <ref>` — fetch component documentation

Print component documentation to stdout. Used by AI to learn component vocabulary on-demand.

```bash
vismd doc diagram@1.0.0           # fetch from registry
vismd doc ./components/Diagram    # read local sibling .md
```

Rules:

- **Exact version only**: `diagram@1.0.0` works, `diagram@1.0` or `diagram` rejects with error
- **Registry**: fetches `<registry>/diagram@1.0.0/docs.md`
- **Local**: reads `./components/Diagram.md` (sibling file next to `Diagram.tsx`)
- **Content is free-form**: `vismd` does not validate or parse `docs.md` structure — it just prints

### 3.3 `vismd check <file>.mdx [flags]` — validate MDX

Validate that the MDX file compiles and uses components correctly.

```bash
vismd check architecture.mdx
vismd check architecture.mdx --assets ./components
```

Validations performed (all of them, in order):

1. MDX parses to a valid AST
2. Every `import` statement resolves (local file exists or remote URL would resolve)
3. Every JSX element references an imported component
4. Every JSX prop matches the component's TypeScript signature

Single file only. Multi-file / glob support is out of scope for MVP.

## 4. MDX authoring contract

AI or human writes MDX with placeholder-based imports:

```mdx
import Diagram from "{{VISMD_LOCAL}}/Diagram"
import StatusReport from "{{VISMD_LOCAL}}/StatusReport"
import Chart from "{{VISMD_REGISTRY}}/chart@1.0.0/Chart"

# Q2 Architecture Review

<StatusReport quarter="Q2-2026" health="amber" />

<Diagram>
{`flowchart LR
  Client --> Gateway --> Service --> DB`}
</Diagram>

<Chart data={[1, 2, 3]} />
```

**Placeholder rules:**

- `{{VISMD_LOCAL}}` → `http://<host>:<port>` of the running `vismd` server
- `{{VISMD_REGISTRY}}` → registry base URL (default: open question)
- Substitution applies to the **entire file**, not just `import` statements (covers `<script src>`, asset URLs, etc.)
- **Case-sensitive**: `{{VISMD_LOCAl}}` is an error, not a silent miss

## 5. Architecture

```
┌────────────────────────────────────────────────┐
│  CLI entry (src/cli.ts)                        │
│  - parse flags / dispatch subcommand           │
└──┬──────────────┬────────────────┬─────────────┘
   │              │                │
   ▼              ▼                ▼
serve mode    doc command     check command
   │              │                │
   ▼              ▼                ▼
┌─────────────┐ ┌──────────┐ ┌──────────────────┐
│ Elysia +    │ │ fetch +  │ │ MDX parse +      │
│ node()      │ │ print    │ │ resolve imports  │
│ on-the-fly  │ │          │ │ + ts type-check  │
│ compile     │ │          │ │                  │
└─────────────┘ └──────────┘ └──────────────────┘
```

### 5.1 Server routes (serve mode)

| Route | Returns | Notes |
|---|---|---|
| `GET /` | HTML shell | Loads MDX entry, wires HMR client |
| `GET /_mdx/<name>.mjs` | Compiled MDX as ESM | Placeholders substituted |
| `GET /<component>.mjs` | Compiled `.tsx`/`.ts` as ESM | esbuild transform |
| `GET /<file>.css` | Static CSS | Auto-mounted from `--assets` |
| `WS  /_hmr` | Reload broadcast | Full page reload on change |

Note that components are served at the **root path** (`/Diagram`), not under `/components/`. This matches the registry pattern where components also live at the root (`vismd.thaitype.dev/diagram@1.0.0/Diagram`), giving local and registry URLs a symmetric shape.

### 5.2 HTML shell sketch

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${mdxBasename}</title>
  <!-- Auto-injected CSS from --assets dir -->
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import { createRoot } from "https://esm.sh/react-dom@18/client"
    import MDX from "/_mdx/${mdxBasename}.mjs"
    createRoot(document.getElementById("root")).render(MDX())
  </script>
  <script type="module" src="/_hmr/client.js"></script>
</body>
</html>
```

### 5.3 MDX compile pipeline

For each `GET /_mdx/<name>.mjs`:

1. Read `<name>.mdx` from disk
2. **Substitute placeholders** in the entire file source string before compile:
   - `{{VISMD_LOCAL}}` → `http://${host}:${port}`
   - `{{VISMD_REGISTRY}}` → configured registry base
3. Scan for any remaining `{{...}}` pattern — if found, **fail loud** with 500 + error message naming the unknown placeholder
4. Run `@mdx-js/mdx` `compile(source, { jsxImportSource: "react", outputFormat: "program", development: true })`
5. Return as `Content-Type: text/javascript`, no cache in dev

### 5.4 Component compile pipeline

For each `GET /<path>.mjs`:

1. Resolve `<path>` against `--assets` dir with extension probe `.tsx | .ts | .jsx | .js`
2. Transform via `esbuild.transform(source, { loader: "tsx", jsx: "automatic", jsxImportSource: "react", format: "esm", sourcemap: "inline" })`
3. Return as `Content-Type: text/javascript`

esbuild is invoked in-process (not as subprocess) — `esbuild` npm package, `transform` API only, no bundling.

### 5.5 CSS auto-inject

On startup, scan `--assets` dir for `*.css` files and inject `<link>` tags into the HTML shell in alphabetical order. No `import "styles.css"` needed in MDX.

### 5.6 HMR (minimal)

Watch `--assets` and the entry `.mdx` with `chokidar`. On change, broadcast `{ type: "reload" }` over WS. Client does `location.reload()`. No granular hot-replace.

### 5.7 `vismd doc` pipeline

For `vismd doc <ref>`:

- **Local ref** (starts with `./` or `../` or `/`): read sibling `.md` file next to the resolved component file. E.g., `./components/Diagram` → read `./components/Diagram.md`. If missing, error.
- **Registry ref** (matches `<name>@<exact-semver>`): validate version is exact 3-part semver. Fetch `<registry>/<name>@<version>/docs.md`. Print response body. On non-200, error.

### 5.8 `vismd check` pipeline

For `vismd check <file>.mdx`:

1. Parse MDX → fail on syntax error
2. Substitute placeholders (same rules as serve mode)
3. Extract all `import` statements
4. For each import:
   - If `http(s)://` URL: HEAD request → ensure 200 (see open question 3)
   - If local path: ensure file exists
5. For each JSX element in the MDX:
   - Confirm the tag name matches an imported binding
   - Type-check props against the component's TypeScript signature (via tsc programmatic API or `@typescript/vfs` against the resolved component source)
6. Exit 0 on pass, non-zero on fail (see open question 4)

## 6. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Runtime | Node 20+ | Universal availability for AI agent users |
| HTTP server | Elysia 1.2+ with `@elysiajs/node` adapter | Familiar; WS first-class; node adapter stable |
| Bundler (publishing) | tsup | Familiar; ESM-first; dts emit |
| TS transform (runtime) | esbuild `transform` API | Sub-10ms per file, no plugin system overhead |
| MDX compile | `@mdx-js/mdx` 3.x | Standard; `outputFormat: "program"` emits ESM |
| File watching | chokidar | Cross-platform |
| CLI parsing | `cac` | Tiny, zero deps, ergonomic |
| Type-check (for `check`) | `typescript` programmatic API | Best fidelity for prop validation |
| HTTP client (for `doc`, registry) | `fetch` (Node built-in) | No extra dep |
| Browser React | esm.sh | No bundling React into vismd |

## 7. Package layout

```
@vismd/cli/
├── src/
│   ├── cli.ts              # entry, cac dispatch
│   ├── commands/
│   │   ├── serve.ts        # default command
│   │   ├── doc.ts          # vismd doc
│   │   └── check.ts        # vismd check
│   ├── server/
│   │   ├── app.ts          # Elysia factory
│   │   ├── compile-mdx.ts
│   │   ├── compile-asset.ts
│   │   ├── shell.ts        # HTML template
│   │   └── hmr.ts
│   ├── placeholders.ts     # substitute + validate
│   ├── resolve.ts          # path/URL resolution
│   └── types.ts
├── package.json
├── tsup.config.ts
├── tsconfig.json
└── README.md
```

### 7.1 `package.json` core fields

```json
{
  "name": "@vismd/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": { "vismd": "./dist/cli.js" },
  "exports": { ".": "./dist/index.js" },
  "engines": { "node": ">=20" },
  "dependencies": {
    "elysia": "^1.2",
    "@elysiajs/node": "^1.2",
    "@mdx-js/mdx": "^3",
    "esbuild": "^0.24",
    "chokidar": "^4",
    "cac": "^6",
    "typescript": "^5.5"
  }
}
```

### 7.2 `tsup.config.ts`

```ts
import { defineConfig } from "tsup"

export default defineConfig({
  entry: { cli: "src/cli.ts", index: "src/index.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: { entry: "src/index.ts" },
  // Shebang only on cli — see open question 1
})
```

## 8. Success criteria for v0.1

- Cold start `npx @vismd/cli@0.1 example.mdx` opens browser in < 3s on a fresh machine
- An MDX file under 1 KB that imports 3 local components renders correctly
- `vismd doc ./components/Diagram` prints `./components/Diagram.md` content
- `vismd doc diagram@1.0.0` fetches and prints registry docs (once a registry exists)
- `vismd check` catches: MDX syntax error, missing component file, undefined JSX tag, wrong prop type
- README explains the import placeholder contract clearly enough that an AI agent can follow

## 9. Open questions (deferred to next phases or to be resolved during development)

### MVP-blockers (need decision before v0.1 ships)

1. **tsup shebang per entry.** Shebang `#!/usr/bin/env node` should only be on `dist/cli.js`, not `dist/index.js`. Does tsup support per-entry banner natively, or do we need a post-build step / two tsup configs?
2. **Default registry URL.** What is `{{VISMD_REGISTRY}}` substituted to by default? `https://vismd.thaitype.dev`? Configurable via `--registry` flag? Env var `VISMD_REGISTRY`? Leaning: env var with sensible default, no flag in v0.1.
3. **`vismd check` for remote imports.** When `check` sees an `https://` import, does it actually HEAD-request the URL (online, slow, accurate) or skip (offline, fast, partial)? Affects CI usability.
4. **`vismd check` exit code semantics.** Exit 0 on pass, 1 on any failure? Or distinguish (1 = MDX parse, 2 = import resolve, 3 = type error)? CI integration depends on this.
5. **Type-check approach.** Use `typescript` programmatic API directly, or `@typescript/vfs` for virtual file system, or shell out to `tsc --noEmit`? Programmatic is faster, vfs handles remote types better, shell-out is simplest. Trade-off: complexity vs accuracy vs speed.
6. **Type-checking remote components.** Local component `.tsx` has source on disk, so type-check is straightforward. Remote registry components have no local source in v0.1 — does `check` skip prop validation for them, or does the registry need to ship `.d.ts` alongside `.tsx` for `check` to fetch?
7. **Wrong placeholder error format.** When the source contains `{{VISMD_UNKNOWN}}`, what does the 500 response look like? Plain text? HTML page? Both browser and AI need to read it.

### Next-phase features (post-v0.1)

8. **Build / static export mode.** Single-file HTML output for sharing. Strategy: inline all components, inline CSS, leave esm.sh refs OR fully offline with `--offline`. Critical for Thariq-style portability.
9. **Registry override.** Map a registry URL to a local component during development. CLI flag (`--override`) or `vismd.config.json`. Useful for developing components before publishing.
10. **Discovery / search.** `vismd search <keyword>` to find components in the registry. Requires registry to expose an index endpoint.
11. **Version range support.** `vismd doc diagram@1.0` (latest patch), `vismd doc diagram@^1` (compatible). v0.1 only supports exact `1.0.0`.
12. **Multi-file check.** `vismd check src/*.mdx` for CI usage.
13. **Local doc folder convention.** v0.1 uses sibling `Diagram.md` next to `Diagram.tsx`. If components grow to need folders with multiple assets, switch convention to `Diagram/docs.md` or support both.
14. **Component vocabulary defaults.** Does Thaitype ship an opinionated default set (`<StatusReport>`, `<Diagram>`, `<MetricCard>`, etc.) as a separate package, or stay user-supplied forever?
15. **Frontmatter in MDX.** Parse `title`, `description` into HTML `<head>`. Currently ignored.
16. **CSS strategy beyond plain files.** CSS modules, Tailwind JIT, scoped CSS. v0.1 only plain `.css`.
17. **HMR granularity.** v0.1 does full-page reload. Granular hot-replace is unnecessary for static artifacts but may matter for interactive components later.
18. **Non-React JSX runtimes.** Vue, Preact, Solid support via `jsxImportSource` swap.
19. **Security stance.** `vismd` evaluates arbitrary MDX. README should warn loudly: "do not run `vismd` on MDX from untrusted sources." Need explicit policy doc.
20. **Skill ecosystem hook.** Currently `vismd doc <ref>` is the AI-facing surface for component vocabulary. If the chief-tribe skill ecosystem grows, does `vismd doc` integrate as a skill (`npx skills add @vismd/diagram@1.0.0`) or stay CLI-only?
21. **Telemetry.** None planned. Reaffirm in README to align with Thaitype OSS posture.
22. **Caching for registry fetches.** `vismd doc diagram@1.0.0` re-fetches every call. Add `~/.vismd/cache/` keyed on exact version (immutable, no invalidation needed)?
