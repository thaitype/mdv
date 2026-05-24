# Contract: HTTP routes

All routes served by the Elysia + `@elysiajs/node` app.

## `GET /`

Returns the HTML shell that boots the MDX entry in the browser.

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

- `{entryBasename}` is the MDX file's basename without `.mdx` extension.
- No `<link>` tags are auto-injected. CSS is referenced explicitly from the MDX body via `{{VISMD_LOCAL}}/styles.css` (browsers honor `<link>` outside `<head>`).

## `GET /_mdx/<name>.mjs`

Compiles `<name>.mdx` from CWD (sibling to the entry) and returns it as ESM.

- **Status (success):** `200`
- **Content-Type:** `text/javascript; charset=utf-8`
- **Cache:** `Cache-Control: no-store` (dev only).
- **Body:** Output of `@mdx-js/mdx` `compile(source, { jsxImportSource: "react", outputFormat: "program", development: true })` after placeholder substitution.

Pipeline per request:
1. Read `<name>.mdx` from disk.
2. Substitute `{{VISMD_LOCAL}}` → `http://<host>:<port>`.
3. Substitute `{{VISMD_REGISTRY}}` → `process.env.VISMD_REGISTRY ?? "https://vismd.thaitype.dev"`.
4. Scan for any remaining `{{...}}` match. If found, return `500` with `Content-Type: text/plain` and body `Unknown placeholder: {{X}}` (where `{{X}}` is the first unknown match).
5. Compile with `@mdx-js/mdx`. On compile error, return `500` with `Content-Type: text/plain` and the compiler error message.
6. Return compiled output.

- **Status (file missing):** `404` with `Content-Type: text/plain` body `Not found: <name>.mdx`.

## `GET /<component>.mjs`

Compiles a source file from `--assets` and returns it as ESM.

- **Status (success):** `200`
- **Content-Type:** `text/javascript; charset=utf-8`
- **Cache:** `Cache-Control: no-store`.
- **Body:** Output of `esbuild.transform(source, { loader: "tsx", jsx: "automatic", jsxImportSource: "react", format: "esm", sourcemap: "inline" })`.

Resolution: given request `GET /<component>.mjs`, probe `<assets>/<component>.tsx`, `<assets>/<component>.ts`, `<assets>/<component>.jsx`, `<assets>/<component>.js` in that order. First match wins.

- **Status (no match):** `404` with `Content-Type: text/plain` body `Not found: <component>`.
- **Status (transform error):** `500` with `Content-Type: text/plain` and the esbuild error message.

## `GET /<file>.css`

Serves a CSS file from `--assets` as static.

- **Status (success):** `200`
- **Content-Type:** `text/css; charset=utf-8`
- **Body:** raw file contents.
- **Status (no file):** `404` with `Content-Type: text/plain` body `Not found: <file>.css`.

## Route precedence

When multiple routes could match, the precedence is:
1. `GET /` (exact).
2. `GET /_mdx/<name>.mjs` (prefix `/_mdx/`).
3. `GET /<file>.css` (suffix `.css`).
4. `GET /<component>.mjs` (suffix `.mjs`).
5. Otherwise `404`.

The reserved prefix `/_mdx/` and the reserved `/_hmr/*` namespace are not used by component resolution, even if a user names a file `_mdx.tsx`. The leading `_` is reserved for vismd-internal routes.

## Error response shape

All error responses in milestone-1 use `Content-Type: text/plain; charset=utf-8` with a single-line body. No JSON, no HTML error pages. Both browsers and AI tools must be able to read the message directly.
