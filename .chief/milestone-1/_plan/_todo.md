# Milestone 1 — TODO

Batch 1 (autopilot, auto mode, started 2026-05-24)

- [x] **task-1: Scaffold package + build pipeline**
  Create `package.json`, `tsconfig.json`, `tsup.config.ts`, `src/cli.ts` (citty skeleton printing version), `src/index.ts` (empty re-export). Verify `npm install` works and `npm run build` produces `dist/cli.js` with `#!/usr/bin/env node` shebang and `dist/index.js` without shebang. Per `_contract/package-layout.md`.

- [x] **task-2: Placeholder substitution + path resolution**
  Implement `src/placeholders.ts` with `substitute(source, { local, registry })` and an unknown-placeholder scan returning the first `{{...}}` that did not get substituted. Implement `src/resolve.ts` with extension-probe (`.tsx` → `.ts` → `.jsx` → `.js`) for components and a CSS path resolver. Add vitest config + unit tests covering: known placeholders substituted, case-sensitive miss flagged as unknown, both placeholders combined, no placeholders is a no-op, extension probe precedence. Per `_goal/placeholder-contract.md`.

- [x] **task-3: Compile pipelines + HTML shell**
  Implement `src/server/compile-mdx.ts` (read file → substitute → unknown-placeholder check → `@mdx-js/mdx` compile with `outputFormat: "program"`, `jsxImportSource: "react"`, `development: true`). Implement `src/server/compile-asset.ts` (esbuild `transform` with `loader: "tsx"`, `jsx: "automatic"`, `jsxImportSource: "react"`, `format: "esm"`, `sourcemap: "inline"`). Implement `src/server/shell.ts` returning the HTML shell template (`createRoot` + esm.sh react-dom client + import of `/_mdx/<entry>.mjs`, no auto-injected `<link>` tags). Unit-test each module where input/output is deterministic.

- [x] **task-4: Elysia server wiring + CLI dispatch + browser open**
  Implement `src/server/app.ts` registering all four routes per `_contract/http-routes.md` with exact status codes, content-types, and error bodies (`Unknown placeholder: {{X}}`, `Not found: ...`, plain text only). Implement `src/commands/serve.ts` that boots the app, prints `http://<host>:<port>` to stdout, prints status to stderr, and opens the browser unless `--no-open`. Wire `src/cli.ts` citty command to dispatch to serve with `--assets` / `--port` / `--host` / `--no-open` flags per `_contract/cli.md`. Honor route precedence (exact `/`, then `/_mdx/`, then `*.css`, then `*.mjs`, else 404).

- [x] **task-5: Example fixture + agent smoke test + human browser-check doc**
  Add `examples/example.mdx` (imports one local component via `{{MDV_LOCAL}}`, has plain text, one JSX element, explicit `<link rel="stylesheet" href="{{MDV_LOCAL}}/styles.css" />`). Add `examples/components/Hello.tsx` (trivial React component) and `examples/components/styles.css` (visible style, e.g., colored heading). Add `scripts/smoke-test.mjs` that: spawns `node dist/cli.js examples/example.mdx --port 5173 --no-open`, waits for boot, curls `/`, `/_mdx/example.mjs`, `/Hello.mjs`, `/styles.css` and asserts the contracts from `_contract/http-routes.md`; also curls a second fixture containing `{{MDV_FOO}}` and asserts the 500 plain-text body; shuts the server down cleanly. Add a `MANUAL_CHECK.md` (or section in README) telling the human how to run `mdv examples/example.mdx` and what they should see in the browser. Add an `npm run smoke` script.

## Verification gate

Milestone-1 is "done" when:
- `npm run build` succeeds.
- `npm test` (unit tests) succeeds.
- `npm run smoke` (agent-runnable smoke test) succeeds.
- The human browser-check doc exists; running it is the human's responsibility.
