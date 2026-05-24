# task-2: CLI strict validation + boot pipeline + MDX entry basename

## Goal

Drop `--assets`. Enforce `.vis.mdx` strict extension, file existence, and entry containment. Update boot pipeline to root the server at `process.cwd()` and print the working directory to stderr. Update the MDX entry route's basename derivation rule.

## Files to change

- `src/cli.ts` — remove `--assets` flag. Add validation steps in this order, before any server boot:
  1. **Extension check**: `args.entry` must end exactly with `.vis.mdx` (case-sensitive). On failure: `process.stderr.write` `vismd: error: file must end in .vis.mdx (got: <basename>). Rename to <basename without .mdx>.vis.mdx.\n` then `process.exit(1)`.
  2. **Existence/readability check**: attempt to read or stat the file. On failure: `vismd: error: cannot read <file>\n` and exit 1.
  3. **Containment check**: compute `entryReal = await fs.realpath(entry)` and `cwdReal = await fs.realpath(process.cwd())`. If `entryReal` does not start with `cwdReal + path.sep`: `vismd: error: entry file <entryReal> is outside working directory <cwdReal>\n` and exit 1.

- `src/commands/serve.ts` — drop `assetsDir` from config. Add `cwd: string` to config (defaults to `process.cwd()` resolved to realpath). Before binding, print to stderr in order:
  ```
  vismd: working directory: <cwdReal>
  vismd: serving <entry-as-given-on-cli>
  ```
  Stdout remains unchanged: exactly one line `http://<host>:<port>` after successful bind.

- `src/server/app.ts` — update the MDX entry route:
  - Compute `entryBasename` at boot from `path.basename(entry)` minus the `.vis.mdx` suffix (e.g., `intro.vis.mdx` → `intro`).
  - `/_mdx/<basename>.mjs` returns the compiled entry MDX only when `<basename>` equals `entryBasename`. Otherwise → 404 + `text/plain` + `Not found: /_mdx/<basename>.mjs`.
  - The HTML shell route `GET /` references `/_mdx/<entryBasename>.mjs` (see `src/server/shell.ts` below).

- `src/server/shell.ts` — update to derive `entryBasename` per the new rule (strip full `.vis.mdx`).

- `src/server/compile-mdx.ts` — confirm it reads the entry file by its absolute path (already resolved at boot), not from the URL. If it currently derives the disk path from URL, fix it.

- `src/server/compile-mdx.test.ts` — update fixture filenames or in-test stubs to use `.vis.mdx` and exercise the new basename derivation.

- `src/server/shell.test.ts` — update for new basename rule.

## Routes affected

Per `.chief/milestone-2/_contract/http-routes.md`:

- `GET /` — unchanged shape; `{entryBasename}` now derived from stripping `.vis.mdx`.
- `GET /_mdx/<basename>.mjs` — strict basename match (404 on mismatch).

## Out of scope for this task

- Asset dispatcher route shape — task-1.
- Fixture file renames + smoke test rewrite — task-3.

## Acceptance criteria

- `pnpm run build` succeeds.
- `pnpm test` passes — updated unit tests cover new basename derivation, new CLI validation paths (extension reject, missing file, outside-cwd reject), and the boot stderr lines.
- Manually invoking `node dist/cli.js examples/example.mdx` (still the old name at this point) produces the extension-rejection error and exits non-zero. (This test is part of acceptance even though fixtures are not yet renamed — the validation path must work in isolation.)
- No new dependencies added.

## Reference contracts

- `.chief/milestone-2/_contract/cli.md` — full file.
- `.chief/milestone-2/_contract/http-routes.md` — §`GET /`, §`GET /_mdx/<basename>.mjs`.
- `.chief/milestone-2/_goal/serve-from-cwd.md` — §"CLI: drop `--assets`", §"Strict `.vis.mdx` entry extension", §"MDX entry containment".
