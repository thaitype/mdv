# Contract: CLI surface

## Command

Single command in milestone-1:

```
vismd <file>.mdx [--assets <dir>] [--port <n>] [--host <h>] [--no-open]
```

`<file>.mdx` is a required positional argument. If missing or not ending in `.mdx`, exit non-zero with a usage message on stderr.

If the file does not exist or is not readable, exit non-zero with `error: cannot read <file>` on stderr.

## Flags

| Flag | Type | Default | Behavior |
|---|---|---|---|
| `--assets` | string (dir path) | `./components` | Directory served as ESM + static assets. Resolved relative to CWD. If missing, vismd still boots (assets routes return 404); does not error at boot. |
| `--port` | number | `0` | Bind port. `0` means pick any free port. The chosen port is printed to stdout after boot. |
| `--host` | string | `127.0.0.1` | Bind host. |
| `--no-open` | boolean | `false` | When set, do not auto-open the browser. |

No other flags in milestone-1. Unknown flags exit non-zero with a usage message.

## CLI library

Use **`citty`** for command + flag parsing. Not `cac`, not `commander`, not hand-rolled.

Reason: citty has typed flag definitions, integrates cleanly with ESM-only Node 20+, and has the smallest API surface for a single-command CLI.

## Stdout / stderr convention

- **stdout**: machine-friendly output only. After successful boot, print one line: `http://<host>:<port>` (the URL).
- **stderr**: human-readable status lines (e.g., `vismd: serving example.mdx`, `vismd: assets dir = ./components`) and all error messages.

This split keeps `vismd example.mdx | xargs open` viable for users who want to script around the URL.

## Exit codes

- `0` — server shut down cleanly (e.g., SIGINT).
- non-zero — any startup failure (bad args, unreadable file, port bind error, etc.).

In milestone-1 we do not enumerate specific non-zero codes. Any non-zero is "something went wrong, see stderr".
