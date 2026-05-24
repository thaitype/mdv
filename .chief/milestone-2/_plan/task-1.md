# task-1: Path resolver + unified asset dispatcher + containment

## Goal

Replace the milestone-1 two-route asset surface (`GET /<component>.mjs` + `GET /<file>.css`) with a single unified asset dispatcher at `GET /*`, rooted at `process.cwd()`, with realpath-based containment and a per-extension handler table.

## Files to change

- `src/resolve.ts` — rewrite. New shape: given (urlPath, cwd), returns either `{ ok: true, kind: "mjs" | "css", diskPath: string }` or `{ ok: false }`. Internally:
  - Reject if URL path has any `..` segment.
  - Reject if URL extension is not `.mjs` or `.css`.
  - For `.mjs`: probe `<cwd>/<stripped>.{tsx,ts,jsx,js}` in that order; first existing wins.
  - For `.css`: exact `<cwd>/<stripped>.css`.
  - After candidate is chosen, `fs.realpath` it and verify the result starts with `realpath(cwd) + path.sep`. On any failure, `{ ok: false }`.
- `src/server/app.ts` — replace the two existing asset routes with one `GET /*` dispatcher that calls the new resolver, plus a `GET /_*` (after `/_mdx/<basename>.mjs` precedence) that returns 404. The MDX entry route `/_mdx/<basename>.mjs` is NOT touched in this task (task-2 owns it).
- `src/resolve.test.ts` — update for new return shape. Add: `..` rejection; symlink-escape rejection (create a tmp symlink that targets outside cwd, assert resolver returns `{ ok: false }`); unknown-extension rejection (`.png`, no ext, etc.).
- `src/server/compile-asset.test.ts` — update for new dispatcher. esbuild transform options unchanged from milestone-1.
- Delete `src/server/serve-css.ts` if it exists as a separate module (consolidate into dispatcher or into resolver helper as the implementer prefers).

## Routes affected

Per `.chief/milestone-2/_contract/http-routes.md`:

- `GET /*` — new. All non-2xx → `404` + `text/plain; charset=utf-8` + body `Not found: <url>`. The body is the URL the browser sent (after the leading `/`, prefix back with `/` for the message). All success responses include `Cache-Control: no-store`.
- `GET /_*` (not matching the MDX entry route) — new. `404` + `text/plain; charset=utf-8` + body `Not found: <url>`.

## Out of scope for this task

- CLI flag changes — task-2.
- `--assets` removal — task-2.
- MDX entry route basename changes — task-2.
- Fixture renames — task-3.

## Acceptance criteria

- `pnpm run build` succeeds.
- `pnpm test` passes. New unit tests in `src/resolve.test.ts` cover `..` rejection, symlink-escape, unknown-extension. Updated tests in `compile-asset.test.ts` reflect the new dispatcher.
- All existing milestone-1 unit tests continue to pass except those covering deleted routes (which should be deleted, not skipped).
- No new dependencies added.

## Reference contracts

- `.chief/milestone-2/_contract/http-routes.md` — §`GET /*`, §"Containment check", §"Status table".
- `.chief/milestone-2/_goal/serve-from-cwd.md` — §"In scope: Real-path imports", §"Containment on every asset request".
