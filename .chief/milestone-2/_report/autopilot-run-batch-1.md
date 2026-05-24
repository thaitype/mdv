# Autopilot Run Batch 1

## Mode

auto

## Summary

Milestone-2 (cwd-rooted serve with `.vis.mdx` strict extension + unified asset dispatcher) is fully implemented end-to-end. The CLI now drops `--assets`, validates `.vis.mdx` strictly, enforces entry containment against `process.cwd()`, prints the working directory to stderr at boot, and serves all assets through a single `GET /*` dispatcher with realpath-based containment. Smoke test passes 10/10 covering the new route surface, validation errors, and the boot stderr line.

## Tasks Completed

- **task-1** (commit `9ac9f25`) — Path resolver rewrite (`src/resolve.ts`) with extension table (`.mjs` probes `.tsx`/`.ts`/`.jsx`/`.js`, `.css` exact), `..` rejection at URL-parse stage, realpath containment via `fs.realpathSync`. Replaced milestone-1's two asset routes in `src/server/app.ts` with a single `GET /*` dispatcher. Added 15 resolver tests covering all rejection paths.

- **task-2** (commit `b78a9e9`) — Dropped `--assets` from `src/cli.ts`. Added three-step validation (extension → existence → containment) with exact stderr messages from the contract. Renamed `AppConfig.assetsDir` → `cwd` and propagated. New basename rule: strip full `.vis.mdx` suffix; route `/_mdx/<basename>.mjs` does strict match (404 otherwise). `src/server/compile-mdx.ts` now reads from the absolute entry path resolved at boot, not URL-derived.

- **task-3** (commit `fdf5f02`) — Renamed `examples/example.mdx` → `example.vis.mdx`, `bad-placeholder.mdx` → `.vis.mdx`. Moved `examples/components/styles.css` → `examples/styles/main.css`. Updated example imports to real paths. Rewrote `scripts/smoke-test.mjs` with 10 assertions covering boot stderr, all route shapes, containment 404, unknown placeholder 500, plain-`.mdx` rejection, outside-cwd rejection, and clean shutdown. Updated `examples/MANUAL_CHECK.md` for new invocation.

## Decisions Made (auto mode only)

No design ambiguity escalated during the run. All decisions were made during the chief-plan grill (Phase 0) prior to autopilot. Implementation paths in each task spec were precise enough that builder-agents executed without escalation.

### Builder-agent self-corrections worth noting

- **task-1 builder** left `AppConfig.assetsDir` named in `app.ts` even though semantically it now meant cwd, explicitly flagging "task-2 will rename it." Acceptable — it kept task-1's diff focused on resolver+dispatcher and left the rename to the natural owner.
- **task-3 builder** had to make one `src/` change to fix an Elysia router conflict (`/_:rest*` collided with `/*` at the memoirist wildcard level). Resolved by inlining the reserved-namespace 404 into the catch-all handler. No behavior change — same 404 response shape. Falls within the builder-agent auto-fix policy.

## Backlog

None for milestone-2. All goal-file success criteria are satisfied:

- `pnpm run build` ✓
- `pnpm test` ✓ (37/37)
- `pnpm smoke` ✓ (10/10)
- `examples/MANUAL_CHECK.md` updated for the new invocation

## Deferred (not part of milestone-2)

These were explicitly scoped out during Phase 0 grill and remain candidates for future milestones:

- **milestone-3**: multi-file mode (browsing many `.vis.mdx` files from one server, index page, navigation).
- **milestone-4**: background daemon + client mode (`vismd start`/`stop`/`status`, lock files, browser-open from any subsequent invocation).
- **`vismd doc`** and **`vismd check`** commands.
- HMR / watch / auto-reload.
- Additional asset extensions (`.png`, `.svg`, `.woff2`) — the dispatcher's handler table is designed to accept them but milestone-2 ships only `.mjs` and `.css`.

## User Action Needed

1. **Housekeeping (recommended)**: Promote two stable contracts from milestone-1 to `.chief/_rules/_contract/` so they don't need to be duplicated per milestone:
   - `placeholder-contract.md` (the `{{VISMD_LOCAL}}` / `{{VISMD_REGISTRY}}` rules).
   - `package-layout.md` (tech stack + bin shape).

   These were explicitly flagged in `_goal/serve-from-cwd.md` as candidates for promotion. Not part of milestone-2's verification gate.

2. **Browser check**: Run `cd examples && node ../dist/cli.js example.vis.mdx` and verify the rendered page looks correct (markdown text, `Hello` component visible, CSS applied). The agent-runnable smoke test covers contract assertions; the visual check is human-only.

3. **Branch note**: The autopilot ran on branch `main.m2`, not `main`. Merge or rename as appropriate.
