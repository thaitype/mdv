# vismd — First Internal Release Spec

**Status:** Draft (grilled 2026-05-24, not yet planned as a milestone)
**Scope:** Minimum to put vismd in an AI agent's hands for end-to-end testing in a user's own project.

## Goal

Ship the bare minimum so an AI agent can write components + `.vis.mdx` from scratch in a user's project, run vismd via `npx`, and iterate on type errors without the human babysitting.

## Decisions

### Q1: `vismd doc` command → Skip

AI reads sibling `.md` next to `Component.tsx` directly with its own file-read tool. No vismd plumbing needed for first internal use.

### Q2: Agent-facing documentation → Ship as installable skill

Distribute via `npx skills@latest add thaitype/vismd` (vercel-labs/skills installer).

The skill covers:
- `.vis.mdx` strict suffix rule.
- `{{VISMD_LOCAL}}` / `{{VISMD_REGISTRY}}` placeholder syntax.
- cwd-rooted real-path import model + the "must `cd` to project root" pitfall.
- Error interpretation: preflight body shape, and the `"vismd browser <level>: ..."` stderr lines that the server emits when the browser shell relays an error back via `/_log` (this is a log-line prefix, not a subcommand).
- Minimal hello-world example (one component + one `.vis.mdx` + invocation).

### Q3: Prop-type feedback loop → Ship `vismd check` full

Use the TypeScript programmatic API, scoped to the MDX's import graph so output is surgical (not noisy whole-project tsc).

**Pipeline:**

1. Compile `.vis.mdx` → synthesized `.tsx` via `@mdx-js/mdx` with `jsx: preserve` (so TS sees real JSX, not runtime calls).
2. Rewrite each `{{VISMD_LOCAL}}`-rooted absolute URL import to a `cwd`-relative path. (Regex on `"http://${local}/..."` in the compiled output.)
3. Write to `os.tmpdir()/vismd-check-<rand>/<basename>.tsx`. Clean up on exit.
4. `ts.createProgram([tmpFile], compilerOptions, host)`. Uses the project's `tsconfig.json` (resolved via `ts.findConfigFile`) if present; otherwise sensible defaults:
   - `strict: true`
   - `jsx: "react-jsx"`
   - `target: "es2022"`
   - `module: "esnext"`
   - `moduleResolution: "bundler"`
5. Get diagnostics. Filter to files under `cwd` (drops `node_modules`, `lib.dom.d.ts`, react internals).
6. Format each diagnostic as `file:line:col: error TSxxxx: message` (matches `tsc` output → editors and AIs already parse this).
7. Exit code: `0` = clean, `1` = type errors found, `2` = tool failure (couldn't compile MDX, missing config, etc.).

**Why this gives scoped output:**

- `tsc` only walks from the synthesized TSX outward. Unrelated `.tsx` files in the project are not visited.
- Components reachable from the entry MDX *are* visited — type errors in their bodies surface (correct: AI should fix them).
- Filtering to `cwd`-relative paths drops noise from `node_modules` and TS lib types.

**Implementation notes:**

| Concern | Approach |
|---|---|
| `react` types | Project must have `@types/react` in `node_modules`. Document as a prereq in the skill. |
| Source mapping | Errors point at synthesized TSX line numbers + a hint `(in compiled MDX from <original>.vis.mdx)`. Real source map deferred to follow-up. |
| compilerOptions when no tsconfig | Defaults listed above. |
| Cleanup | `os.tmpdir()` so OS handles eventual cleanup; explicit `fs.rm` on exit when possible. |
| Cost | ~2 days, no new runtime deps (`typescript` is the only new dependency). |

### Distribution

Publish `@vismd/cli` to npm so `npx @vismd/cli ...` works. Strictly required for the AI workflow described above.

## Open Questions (Parked)

- [ ] **`vismd doc <ref>`** — add when (a) a shared registry exists, (b) projects grow large enough that AI re-reading all `.tsx` is wasteful, or (c) you want curated prose docs alongside source.
- [ ] **MDX → TSX source mapping for `vismd check`** — first release reports errors with synthesized-TSX line numbers + a hint pointing back to the original `.vis.mdx`. Build a real source map when actual usage shows it matters.
- [ ] **Extend `/_log` to capture `console.warn` + `console.error`** — would relay React's runtime warnings (keys, controlled inputs, hydration, hook-rule violations) to CLI. Tiny change (~10 lines in `shell.ts`). Deferred behind `vismd check` since check covers the higher-value prop-type case.
- [ ] **`vismd check` for remote imports** — currently only handles local-cwd-rooted imports. Remote registry component prop validation needs the registry to ship `.d.ts` alongside source.
- [ ] **Multi-file check** (`vismd check src/*.vis.mdx`) — for CI usage when multiple MDX files exist.
- [ ] **`vismd doc` cache** (`~/.vismd/cache/`) — only matters once `vismd doc` ships and a registry exists.

## What this release does NOT include

- Multi-file foreground mode (deferred to M3, see `spec-multi-files-serve.md`).
- Background daemon (deferred to M4, see `spec-multi-files-serve.md`).
- HMR / file watching.
- `vismd doc` command.
- Bundling / static export.
- Anything beyond localhost-127.0.0.1 binding.

## Implied work order

1. Build `vismd check` per the pipeline above.
2. Write the `thaitype/vismd` skill file in the format vercel-labs/skills consumes (likely `vismd.md` at a known path; verify against vercel-labs/skills docs).
3. Add CI to publish `@vismd/cli` to npm on release tag.
4. Tag `v0.2.0`, publish, run end-to-end test with an AI agent in a fresh project.
