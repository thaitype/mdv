# vismd — MDX dev viewer

Serve a `.vis.mdx` file in the browser with on-the-fly compilation and live component resolution. Zero build step, zero config.

## Install / run

```bash
# One-off via npx (no install)
npx @vismd/cli path/to/file.vis.mdx

# Or install globally
npm install -g @vismd/cli
vismd path/to/file.vis.mdx
```

Flags:

| Flag | Default | Meaning |
|---|---|---|
| `--port <n>` | `0` (auto-pick) | Bind port. |
| `--host <h>` | `127.0.0.1` | Bind host. |
| `--no-open` | `false` | Don't auto-open the browser. |

## How it works

`vismd` boots a small dev server rooted at your current working directory. Your `.vis.mdx` file imports components and assets as real paths from that root:

```mdx
import Hello from "{{VISMD_LOCAL}}/components/Hello"

<link rel="stylesheet" href="{{VISMD_LOCAL}}/styles/main.css" />

# My doc
<Hello name="world" />
```

`{{VISMD_LOCAL}}` substitutes to the running server's URL at request time. So `/components/Hello` resolves to `<cwd>/components/Hello.{tsx,ts,jsx,js}` (extension probed) and `/styles/main.css` resolves to `<cwd>/styles/main.css`.

Two rules to remember:

1. **The file must end in `.vis.mdx`.** Plain `.mdx` is rejected. The suffix signals "this MDX uses vismd conventions" — readable from a directory listing.
2. **`vismd` uses your shell's cwd as the server root.** Imports inside the MDX are resolved relative to that root. Run from the directory those import paths are relative to (usually your project root). vismd prints `vismd: working directory: <path>` at boot so you can sanity-check.

If an import path doesn't resolve, vismd surfaces it both in the browser (red error block in the page) and in the terminal (`vismd browser error: ...`). No silent failures.

## Example

The repo ships a working fixture under `examples/`:

```bash
git clone https://github.com/thaitype/vismd.git
cd vismd
pnpm install
pnpm run build

cd examples
node ../dist/cli.js example.vis.mdx
```

The `cd examples` matters — the example's imports (`/components/Hello`, `/styles/main.css`) are relative to `examples/`, so that has to be cwd.

See [`examples/MANUAL_CHECK.md`](examples/MANUAL_CHECK.md) for the human verification checklist.

## What's in the box

- HTTP routes:
  - `GET /` — HTML shell that boots the MDX entry.
  - `GET /_mdx/<basename>.mjs` — compiled MDX (basename = entry filename minus `.vis.mdx`).
  - `GET /*` — unified asset dispatcher (`.mjs` and bare URLs probe `.tsx`/`.ts`/`.jsx`/`.js`; `.css` raw; other extensions 404).
- Placeholders: `{{VISMD_LOCAL}}` (server URL) and `{{VISMD_REGISTRY}}` (`$VISMD_REGISTRY` env, default `https://vismd.thaitype.dev`).
- React loaded from `esm.sh` via importmap. Nothing bundled into vismd.
- Containment: requests with `..` are rejected; resolved paths must stay inside cwd (realpath-checked).

## Development

```bash
pnpm install
pnpm run build      # tsup → dist/cli.js + dist/index.js
pnpm test           # vitest, unit tests
pnpm smoke          # end-to-end CLI + HTTP contract checks
```

## License

MIT
