# task-3: Fixture migration + smoke test rewrite + manual check doc

## Goal

Migrate the example fixture to the new `.vis.mdx` extension + cwd-rooted real-path import shape. Rewrite the smoke test to exercise the new route surface, the unified asset dispatcher, the boot stderr line, and the new CLI validation errors. Update the human browser-check doc.

## Files to change

### Renames + moves

- `examples/example.mdx` → `examples/example.vis.mdx`
- `examples/bad-placeholder.mdx` → `examples/bad-placeholder.vis.mdx`
- `examples/components/styles.css` → `examples/styles/main.css` (create `examples/styles/` directory)

### Content updates

- `examples/example.vis.mdx` — change imports to real paths from cwd (cwd = `examples/`):
  ```mdx
  import Hello from "{{VISMD_LOCAL}}/components/Hello"

  <link rel="stylesheet" href="{{VISMD_LOCAL}}/styles/main.css" />

  # Example
  <Hello name="vismd" />
  ```
  (Preserve any existing prose; just update the two URLs.)

- `examples/bad-placeholder.vis.mdx` — keep contents (unknown `{{VISMD_FOO}}` placeholder); only the filename changes.

- `examples/components/Hello.tsx` — unchanged.

### `scripts/smoke-test.mjs` — full rewrite

Spawn the server using `{ cwd: 'examples' }` and a relative path to the built CLI:

```js
spawn('node', ['../dist/cli.js', 'example.vis.mdx', '--port', '5173', '--no-open'], { cwd: 'examples', stdio: ['ignore', 'pipe', 'pipe'] })
```

Assertions (all must pass):

1. **Boot stderr contains the working-directory line.** Match against `/^vismd: working directory: .*\/examples$/m` on captured stderr.
2. `GET http://127.0.0.1:5173/` → 200, `text/html`, body contains `/_mdx/example.mjs`.
3. `GET /_mdx/example.mjs` → 200, `text/javascript`, body does NOT contain `{{VISMD_LOCAL}}` (substitution happened).
4. `GET /components/Hello.mjs` → 200, `text/javascript`.
5. `GET /styles/main.css` → 200, `text/css`.
6. `GET /../etc/passwd` → 404, `text/plain`, body matches `/^Not found:/`. (curl may normalize the URL; if so, use `curl --path-as-is` or assert on what the server actually receives.)
7. Spawn second server on `bad-placeholder.vis.mdx`. `GET /_mdx/bad-placeholder.mjs` → 500, `text/plain`, body `Unknown placeholder: {{VISMD_FOO}}`. Shut down.
8. Spawn `node ../dist/cli.js plain.mdx` (any path with `.mdx` not `.vis.mdx`). Assert exit code non-zero AND stderr contains `must end in .vis.mdx`.
9. Spawn with an entry path that resolves outside the spawn cwd (e.g., `vismd ../README.md` after temporarily creating an outside-cwd `.vis.mdx`, or simpler: from `cwd: examples/`, spawn with an absolute path pointing somewhere outside `examples/`). Assert exit code non-zero AND stderr contains `outside working directory`.
10. All spawned servers are shut down cleanly at end (kill PID + await exit).

Use the existing helper style from milestone-1's smoke test (small assertion DSL — `contains`, `equals`, `notContains`). Keep output legible: one line per assertion result.

### `examples/MANUAL_CHECK.md` — update

- Replace `vismd examples/example.mdx` with `cd examples && vismd example.vis.mdx`.
- Update file references (`example.mdx` → `example.vis.mdx`, `components/styles.css` → `styles/main.css`).
- Note the new boot stderr line so the human knows what to expect.

### `package.json`

- `pnpm smoke` script unchanged (still `node scripts/smoke-test.mjs`).

## Out of scope for this task

- Code changes to `src/` — those are task-1 and task-2.

## Acceptance criteria

- `pnpm run build` succeeds (no code changes here, but build must remain green).
- `pnpm test` passes (no test changes here, but build must remain green).
- `pnpm smoke` passes end-to-end, exercising all 10 assertions above.
- `examples/MANUAL_CHECK.md` reflects the new invocation and fixture paths.

## Reference contracts

- `.chief/milestone-2/_goal/serve-from-cwd.md` — §"Success criteria".
- `.chief/milestone-2/_contract/http-routes.md` — full route surface (assertions in the smoke test must mirror the status table).
- `.chief/milestone-2/_contract/cli.md` — §"Argument validation", §"Stdout / stderr convention".
