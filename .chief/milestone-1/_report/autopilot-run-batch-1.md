# Autopilot Run Batch 1

## Mode
auto

## Summary

Milestone-1 (`mdv` serve-only) is implemented end-to-end. The CLI `mdv <file>.mdx` boots an Elysia + `@elysiajs/node` server with four routes: HTML shell, MDX compile (with placeholder substitution), component compile (esbuild transform), static CSS. All routes conform to `_contract/http-routes.md`. Agent-runnable smoke test (`pnpm smoke`) exercises all six contracted behaviors and passes 6/6. Human browser-check doc (`examples/MANUAL_CHECK.md`) is in place for visual verification.

## Tasks Completed

- **task-1**: Scaffold package + build pipeline. `package.json`, `tsconfig.json`, `tsup.config.ts` (per-entry `banner` for `cli.ts` shebang), `src/cli.ts` citty skeleton, `src/index.ts` stub. Build produces `dist/cli.js` (with shebang) and `dist/index.js` (no shebang) + `dist/index.d.ts`. Template cruft (`lib.ts`, `main.ts`) removed; `@types/node` added.
- **task-2**: `src/placeholders.ts` (`substitute` with `SubstituteResult` discriminated union) + `src/resolve.ts` (`resolveComponent` extension probe, `resolveCss`, both reject path traversal). 16 vitest unit tests, all green.
- **task-3**: `src/server/compile-mdx.ts` (read → substitute → `@mdx-js/mdx` compile with `outputFormat: "program"`, `jsxImportSource: "react"`, `development: true`), `src/server/compile-asset.ts` (resolve → esbuild `transform` with `loader: "tsx"`, `jsx: "automatic"`, ESM, inline sourcemap), `src/server/shell.ts` (HTML template with esm.sh react-dom client, no auto-injected `<link>`). +13 tests (29 total).
- **task-4**: `src/server/app.ts` (Elysia factory, all 4 routes with correct precedence, `Cache-Control: no-store`, plain-text single-line errors, reserved `/_*` prefix excluded from component resolution), `src/commands/serve.ts` (port-0 probe via `net.createServer` to derive `local` baseUrl before Elysia boots; SIGINT handler; stderr status / stdout URL split), `src/cli.ts` (full citty wiring: positional `entry` + `--assets`, `--port`, `--host`, `--no-open`). Manual end-to-end curl verification by builder passed all 7 spot checks.
- **task-5**: `examples/example.mdx`, `examples/components/Hello.tsx`, `examples/components/styles.css`, `examples/bad-placeholder.mdx`, `examples/MANUAL_CHECK.md`, `scripts/smoke-test.mjs` (~140 lines, no extra deps), `package.json` smoke script with `presmoke` build hook, README "Quick start" section prepended.

## Decisions Made (auto mode)

- **Issue**: `pnpm install` warned esbuild's `postinstall` was ignored due to pnpm 10's `onlyBuiltDependencies` gate.
  **Options**: (a) run `pnpm approve-builds` interactively, (b) add `pnpm.onlyBuiltDependencies: ["esbuild"]` to `package.json`, (c) ignore (esbuild can run from JS fallback).
  **Chosen**: (b).
  **Reason**: Reproducible across machines, no manual step, narrow scope to the one dep that needs it.

- **Issue**: vitest 4.x crashed on Node 24 with `ERR_PACKAGE_PATH_NOT_EXPORTED` from vite 5.
  **Options**: (a) downgrade vitest, (b) upgrade Node toolchain, (c) skip tests.
  **Chosen**: (a) downgrade to vitest 3.2.4 (via builder during task-2).
  **Reason**: Test runner stability outranks chasing the latest major; we have no vitest 4 features in use.

- **Issue**: `tsup` shebang per entry — the carried-over open question.
  **Options**: (a) post-build script, (b) two tsup configs, (c) `banner` option per config.
  **Chosen**: (c) — `defineConfig([...])` array with `banner: { js: "#!/usr/bin/env node" }` on the cli entry only.
  **Reason**: Native tsup feature, zero scripting, one file.

- **Issue**: browser-open implementation — extra dep (`open`) vs `child_process` + platform command.
  **Options**: (a) `open` npm package, (b) `child_process.exec` per-platform.
  **Chosen**: (b).
  **Reason**: Zero new deps, ~10 lines, matches AGENTS.md "simplicity first" rule.

- **Issue**: `port: 0` (OS-auto) — `local` baseUrl must reflect actual bound port BEFORE first MDX request, so `{{MDV_LOCAL}}` substitutes correctly.
  **Options**: (a) bind Elysia, read actual port, re-create app, re-bind, (b) probe with `net.createServer` first, read port, then construct app + bind once.
  **Chosen**: (b).
  **Reason**: One bind cycle, no app re-instantiation. Small race window between probe-close and Elysia-bind is acceptable for a dev tool.

- **Issue**: IDE diagnostics on `examples/components/Hello.tsx` complaining about missing React types (mdv intentionally does not depend on React — runtime React comes from esm.sh in the browser).
  **Options**: (a) install `@types/react` (defeats "mdv ships zero React" design), (b) add `// @ts-nocheck` to the fixture, (c) add `examples` to tsconfig `exclude`.
  **Chosen**: (c).
  **Reason**: tsconfig's `include: ["src/**/*.ts"]` already excluded `examples/` from build typecheck; adding explicit `exclude` silences the IDE language server too. Surgical, no design compromise.

## Backlog

- **Spurious Elysia stop error on SIGINT**: `pnpm smoke` exits 0 and all 6 checks pass, but a `[ERROR] Cannot read properties of undefined (reading ...)` line is printed to stderr by `src/commands/serve.ts` when the SIGINT handler calls `app.stop()` on the `@elysiajs/node` adapter. Cosmetic — does not affect functionality or exit codes. Cleanup candidate for milestone-2 polish.
- **Open question (deferred from `draft/spec-phase-1.md`)**: tsup per-entry shebang — RESOLVED in this milestone (used `banner` option in `defineConfig` array). The open question can be closed in any future spec doc revision.
- **Browser-side React version pin (esm.sh)**: the shell hardcodes `react-dom@18`. Migration to React 19 is a future-milestone concern.

## User Action Needed

- **Run the human browser check** per `examples/MANUAL_CHECK.md`:
  1. `pnpm install && pnpm run build`
  2. `node dist/cli.js examples/example.mdx --assets examples/components`
  3. Confirm browser opens, renders the "Hi" heading, the "Hello, world!" greeting from `<Hello>`, and the tomato color from the stylesheet.
  This is the final gate for milestone-1; the agent has completed everything it can verify autonomously.

## Milestone-1 status

**Complete (pending human browser check).**

- `pnpm exec tsc --noEmit` — zero errors
- `pnpm test` — 29/29 passing
- `pnpm run build` — succeeds
- `pnpm smoke` — 6/6 checks pass, exit 0
