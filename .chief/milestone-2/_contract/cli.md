# Contract: CLI surface (milestone-2)

## Command

Single command in milestone-2:

```
vismd <file>.vis.mdx [--port <n>] [--host <h>] [--no-open]
```

`<file>.vis.mdx` is a required positional argument.

## Argument validation

Validation runs in this order before any server boot:

1. **Extension check** — `<file>` must end with `.vis.mdx` (exact, case-sensitive suffix). On failure, exit non-zero with stderr:
   ```
   vismd: error: file must end in .vis.mdx (got: <name>). Rename to <name without .mdx>.vis.mdx.
   ```
2. **Existence + readability** — the file must exist and be readable. On failure, exit non-zero with stderr `vismd: error: cannot read <file>`.
3. **Containment** — the resolved absolute path (via `realpath`) must be a descendant of `process.cwd()` (also via `realpath`). On failure, exit non-zero with stderr:
   ```
   vismd: error: entry file <abs path> is outside working directory <abs cwd>
   ```

## Flags

| Flag | Type | Default | Behavior |
|---|---|---|---|
| `--port` | number | `0` | Bind port. `0` means pick any free port. The chosen port is printed to stdout after boot. |
| `--host` | string | `127.0.0.1` | Bind host. |
| `--no-open` | boolean | `false` | When set, do not auto-open the browser. |

**Removed from milestone-1**: `--assets`. Passing it triggers citty's unknown-flag error path (non-zero exit, usage on stderr).

No other flags in milestone-2.

## CLI library

Continue using **`citty`** (already in deps from milestone-1). No new dependency.

## Stdout / stderr convention

- **stdout**: machine-friendly. After successful boot, print exactly one line: `http://<host>:<port>`.
- **stderr**: human-readable status lines and all error messages. After validation passes and before binding, print (in this order):
  ```
  vismd: working directory: <abs cwd>
  vismd: serving <entry-as-given-on-cli>
  ```
  The working-directory line is required so the user can sanity-check what root the server is rooted at before debugging "why didn't my import resolve."

## Working directory

The server's root is `process.cwd()` at the moment `vismd` is invoked. **Literal — no find-up to `package.json`, no other discovery.** Whatever cwd the process inherits from its parent (shell, `pnpm exec`, `npm run`, `npx`, etc.) is used as-is.

The contract is: `vismd` does not change cwd, does not search upward, does not consult any config file to override cwd.

## Exit codes

- `0` — server shut down cleanly (e.g., SIGINT).
- non-zero — any startup failure: bad args, validation failure, port bind error, etc.

Milestone-2 does not enumerate specific non-zero codes.
