# Contract: Package layout and tech stack

## Tech stack (locked for milestone-1)

| Concern | Choice |
|---|---|
| Runtime | Node `>=20` |
| HTTP server | `elysia` ^1.2 with `@elysiajs/node` adapter |
| MDX compile | `@mdx-js/mdx` ^3 |
| TS/JSX transform | `esbuild` ^0.24 (`transform` API only, no bundling, no plugins) |
| CLI parsing | `citty` (latest) |
| Bundler (publishing) | `tsup` |
| Browser open | `open` (or equivalent minimal dep); skipped when `--no-open` |
| Browser React | `esm.sh` (not bundled into mdv) |

Not in milestone-1: `chokidar`, WebSocket libs, `typescript` programmatic API.

## Source layout

```
src/
├── cli.ts               # citty entry, dispatch to serve()
├── commands/
│   └── serve.ts         # boot Elysia app, handle --no-open
├── server/
│   ├── app.ts           # Elysia factory: registers all routes
│   ├── shell.ts         # HTML shell template
│   ├── compile-mdx.ts   # read + substitute + @mdx-js compile
│   ├── compile-asset.ts # extension probe + esbuild transform
│   └── serve-css.ts     # static CSS read
├── placeholders.ts      # substitute() + validate-unknown
├── resolve.ts           # path resolution against --assets
└── types.ts             # shared types (Config, etc.)
```

`src/index.ts` exists but in milestone-1 may re-export only types — there is no programmatic API surface yet.

## `package.json` core fields

```json
{
  "name": "@thaitype/mdv",
  "version": "0.1.0",
  "type": "module",
  "bin": { "mdv": "./dist/cli.js" },
  "exports": { ".": "./dist/index.js" },
  "engines": { "node": ">=20" },
  "dependencies": {
    "elysia": "^1.2",
    "@elysiajs/node": "^1.2",
    "@mdx-js/mdx": "^3",
    "esbuild": "^0.24",
    "citty": "latest"
  },
  "devDependencies": {
    "tsup": "latest",
    "typescript": "^5.5"
  }
}
```

## Build

`tsup` builds two entries:

- `src/cli.ts` → `dist/cli.js` (must have `#!/usr/bin/env node` shebang).
- `src/index.ts` → `dist/index.js` (no shebang) + `dist/index.d.ts`.

The shebang-per-entry mechanism is an open question (carried over from `draft/spec-phase-1.md`); the builder may use a post-build script or two tsup configs as needed. This is a build-time concern, not a runtime contract.

## What is NOT a contract here

- Internal function signatures, parameter names, and module-internal types are at the implementer's discretion, as long as the HTTP route contracts and CLI contracts are honored.
- File names within `src/` are suggestions; the layout above is a hint, not a hard schema. The hard schema is: `bin` entry produces a working `mdv` command that satisfies the CLI + route contracts.
