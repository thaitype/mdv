# Contract: HTTP routes (milestone-2)

All routes served by the Elysia + `@elysiajs/node` app. Working directory (`cwd`) below means `process.cwd()` resolved to an absolute, real path at boot.

## Route precedence

When multiple routes could match, precedence is:

1. `GET /` (exact).
2. `GET /_mdx/<basename>.mjs` (literal prefix `/_mdx/`).
3. `GET /_*` — any other path under the `/_` prefix → reserved, return 404 with body `Not found: <url>`.
4. `GET /*` (asset dispatcher).

The `/_` prefix is reserved for vismd-internal routes and never resolves to a user file, even if a user creates a directory named `_mdx` or a file named `_anything.tsx` under cwd.

## `GET /`

Returns the HTML shell that boots the MDX entry in the browser. Unchanged from milestone-1 except for how `entryBasename` is derived.

- **Status:** `200`
- **Content-Type:** `text/html; charset=utf-8`
- **Body shape:**

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>{entryBasename}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import { createRoot } from "https://esm.sh/react-dom@18/client"
    import MDX from "/_mdx/{entryBasename}.mjs"
    createRoot(document.getElementById("root")).render(MDX())
  </script>
</body>
</html>
```

- `{entryBasename}` is the entry filename with the full `.vis.mdx` suffix stripped (e.g., `docs/intro.vis.mdx` → `intro`).

## `GET /_mdx/<basename>.mjs`

Compiles the **entry `.vis.mdx` file** (the one passed on the CLI) and returns it as ESM.

- The basename in the URL must equal the entry file's basename (computed at boot per the rule above). Any other basename → 404 with `Not found: /_mdx/<url-basename>.mjs`.
- **Status (success):** `200`
- **Content-Type:** `text/javascript; charset=utf-8`
- **Cache:** `Cache-Control: no-store`.
- **Body:** Output of `@mdx-js/mdx` `compile(source, { jsxImportSource: "react", outputFormat: "program", development: true })` after placeholder substitution.

Pipeline per request:

1. Read the entry file from its absolute path (resolved at boot, not from URL).
2. Substitute `{{VISMD_LOCAL}}` → `http://<host>:<port>`.
3. Substitute `{{VISMD_REGISTRY}}` → `process.env.VISMD_REGISTRY ?? "https://vismd.thaitype.dev"`.
4. Scan for any remaining `{{...}}` match. If found → `500`, `text/plain`, body `Unknown placeholder: {{X}}` where `{{X}}` is the first unknown match.
5. Compile with `@mdx-js/mdx`. On compile error → `500`, `text/plain`, body is the compiler error message.
6. Return compiled output.

The entry file is fixed at boot. There is no multi-file routing here; milestone-2 serves exactly one MDX entry per server.

## `GET /*` — unified asset dispatcher

Serves any file under cwd, with per-extension behavior. This is the only general-purpose route.

### Pre-resolution rejections (apply before any disk access)

- If the URL path contains any `..` segment → 404, `text/plain`, body `Not found: <url>`. Even if normalization would yield a path still inside cwd, the request is rejected (the rule is simpler and stricter than path normalization).
- If the URL path is exactly `/`, that's handled by the named `GET /` route above (precedence). For the dispatcher, treat `/` as a 404 — it never falls through.

### Resolution rules

The URL path (with the leading `/` stripped) is treated as a path relative to cwd. The handler chosen by the URL's extension:

| URL extension | Source candidates (tried in order) | Response behavior |
|---|---|---|
| `.mjs` | `<path>.tsx`, `<path>.ts`, `<path>.jsx`, `<path>.js` (first existing wins) | esbuild transform → `text/javascript; charset=utf-8`, `Cache-Control: no-store`. |
| `.css` | `<path>.css` (exact, no probe) | Raw file body → `text/css; charset=utf-8`, `Cache-Control: no-store`. |

For `.mjs`, the URL ends in `.mjs` but the on-disk source ends in `.tsx`/`.ts`/`.jsx`/`.js`. The conversion is: strip `.mjs` from the URL, probe the four extensions against `<cwd>/<stripped>.<ext>`.

For `.css`, the URL extension and on-disk extension match exactly.

Any URL extension not in the table → 404 with body `Not found: <url>`.

### Containment check (every request)

After picking a candidate disk path:

1. Resolve to its real absolute path via `fs.realpath` (defeats symlink escape).
2. Check the real path starts with cwd's real absolute path + path separator.
3. If the check fails → 404 with body `Not found: <url>`. Same 404 shape as a missing file; no `403`, no enforcement-layer signal.

### Status table

| Case | Status | Content-Type | Body |
|---|---|---|---|
| `.mjs` source found, transform succeeds | `200` | `text/javascript; charset=utf-8` | esbuild output |
| `.mjs` source found, transform fails | `500` | `text/plain; charset=utf-8` | esbuild error message |
| `.mjs` source not found (no probe extension matched) | `404` | `text/plain; charset=utf-8` | `Not found: <url>` |
| `.css` file found | `200` | `text/css; charset=utf-8` | raw file contents |
| `.css` file not found | `404` | `text/plain; charset=utf-8` | `Not found: <url>` |
| URL contains `..` | `404` | `text/plain; charset=utf-8` | `Not found: <url>` |
| Resolved real path escapes cwd | `404` | `text/plain; charset=utf-8` | `Not found: <url>` |
| URL extension unknown | `404` | `text/plain; charset=utf-8` | `Not found: <url>` |

### esbuild transform options (unchanged from milestone-1)

```ts
esbuild.transform(source, {
  loader: "tsx",
  jsx: "automatic",
  jsxImportSource: "react",
  format: "esm",
  sourcemap: "inline",
})
```

## Error response shape

All non-2xx responses use `Content-Type: text/plain; charset=utf-8` with a single-line body. No JSON, no HTML. Absolute disk paths are never included in HTTP response bodies — only the URL the browser requested. The user already knows their cwd (printed at boot).

## What this contract does NOT cover

- Internal module structure (`src/server/*.ts` file layout) — implementer's choice as long as the routes match.
- HMR, file watching — out of scope for milestone-2.
- Index/listing routes for multi-file mode — deferred to milestone-3.
- Background daemon endpoints (`/_status`, etc.) — deferred to milestone-4. The `/_` namespace is reserved so they can land non-breakingly.
