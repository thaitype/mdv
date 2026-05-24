# vismd — Design Spec Phase 3 (M3 + M4)

**Status:** Draft (sketches from Phase 0 grill, not yet planned)
**Date:** 2026-05-24

Covers two future milestones agreed during the milestone-2 grill but explicitly deferred:

- **M3** — multi-file mode in foreground server
- **M4** — background daemon + client mode

M2 ships single-file foreground only. M3 unlocks multi-file ergonomics with the same one-terminal-per-session model. M4 wraps it in lifecycle so `vismd <file>` becomes a thin client.

Sequencing rationale: M3 validates the routing/index surface in a debuggable foreground; M4 only adds the lifecycle layer on top, reusing M3's routes wholesale. Doing them together would mean designing routing and daemon lifecycle simultaneously and shipping neither cleanly.

---

## Part 1 — M3: Multi-file foreground

### Mental model

One server, one terminal, browse many `.vis.mdx` files under cwd.

### CLI shape

| Invocation | Behavior |
|---|---|
| `vismd <file>.vis.mdx` | Single-file mode. Unchanged from M2. Renders at `/`. |
| `vismd` (no arg) | Directory-discovery mode. Walks cwd recursively for `*.vis.mdx`. Index at `/`. |

Both modes use the same server; the boot-time decision is just whether the entry is a fixed file or the cwd is itself the entry point.

### Routes (additions over M2)

| Route | Purpose |
|---|---|
| `GET /` | Index page (dir mode) OR HTML shell for the single entry (single-file mode). |
| `GET /<path>` (extensionless, no `.`) | MDX page shell for the file at `<cwd>/<path>.vis.mdx`. |
| `GET /_mdx/<path>.mjs` | Compiled MDX. `<path>` can now include subdirs. |
| `GET /*` | Asset dispatcher. Unchanged from M2. |

Extensionless URLs and asset URLs (`.mjs`/`.css`/etc.) are disjoint because asset extensions are explicit. So `/foo` is an MDX page request and `/foo.mjs` is an asset request — no collision.

### Discovery rules

- Recursive walk of cwd, filtered to `*.vis.mdx`.
- Skipped: anything under `node_modules/`, `.git/`, hidden dirs (starting with `.`), `dist/`, `build/` (configurable later if needed).
- Index lists files with their relative path; clicking renders.
- Discovery is **per-request**, not watched. Adding a file → reload index. No chokidar dep.

### Index UI shape

Plain HTML — same minimal aesthetic as the error block:

- Flat list, sorted alphabetically by relative path.
- Each line: relative path → clickable to `/<path-without-suffix>`.
- No file count, no preview, no search (yet). Less is more for a dev tool.

### Open questions for M3 planning

1. **Index sort order**: alphabetical (predictable) vs mtime-desc (most-recently-edited first). Lean alphabetical.
2. **Path collision**: if two files have basenames that produce the same URL (`a/foo.vis.mdx` and `b/foo.vis.mdx`), what happens? Both render at distinct URLs because the URL keeps the dir prefix — no collision.
3. **Index when single-file mode used**: should `GET /index` (or some explicit URL) still expose the directory index? Probably yes, so the user can navigate sideways without restarting. Decide later.
4. **MDX with broken imports in index mode**: render the index regardless; the preflight error only fires on the page that imports them.
5. **Title in `<title>`**: just basename, or `parent/basename`? Lean `parent/basename` to distinguish.
6. **Anything under `_*` excluded from discovery**: reserved-namespace consistency.

### What M3 does NOT change

- Asset dispatcher logic (M2-final).
- Containment rules.
- Placeholder substitution.
- `.vis.mdx` strict extension.
- Browser → CLI error relay (`/_log`).
- HTML shell error block.

---

## Part 2 — M4: Background daemon + client mode

### Mental model

One persistent server per project. `vismd <file>` becomes a thin client: looks up the running server, opens the browser, exits. No dedicated terminal.

### CLI shape

New explicit lifecycle commands:

| Command | Behavior |
|---|---|
| `vismd start` | Spawn detached server bound to cwd. Write lock file. Exit. |
| `vismd stop` | Read lock, send SIGTERM, delete lock, exit. |
| `vismd status` | Print lock contents + liveness, exit. |

Modified default command:

| `vismd <file>.vis.mdx` | If lock exists and PID alive → open browser to `/<path-without-suffix>`, exit. Else `vismd start` first, then open, exit. |

### Per-project, not global

Lock file at `<cwd>/.vismd/server.json`:

```json
{
  "pid": 12345,
  "port": 5173,
  "cwd": "/Users/thada/projects/docs",
  "startedAt": "2026-05-24T22:00:00Z",
  "version": "0.2.0"
}
```

Each project's directory has its own server on its own port. A global daemon (one process, multi-root routing) was considered and rejected:

- Multi-root routing collides with M2's "URL = path relative to cwd" model.
- Cross-project URL namespace introduces a new mental layer.
- Per-project isolation is naturally simpler.

The cost is N processes for N active projects. For a dev tool this is acceptable; users rarely run 5+ simultaneously.

### Cross-platform detachment

Mac/Linux: `child_process.spawn('node', [...], { detached: true, stdio: 'ignore', windowsHide: true }).unref()` — battle-tested.

Windows: same incantation but with quirks around cmd.exe console attachment. Requires `windowsHide: true` plus `stdio: 'ignore'` plus `unref()`. Smoke-test on Windows before declaring M4 done.

### Lifecycle details

| Concern | Approach |
|---|---|
| Liveness | `process.kill(pid, 0)` — throws if not alive. Cross-platform. |
| Stale lock | On every invocation, validate PID. If dead → delete lock, respawn. |
| Logs | `<cwd>/.vismd/server.log`. Server has no terminal once detached. Unrotated for v0.x; user clears manually. |
| Port pick | Server picks free port on first boot, writes to lock; client reads it. |
| `vismd start` when already running | Print "already running on port X" + status, exit 0 (idempotent). |
| `vismd stop` when not running | Print "no running server", exit 0 (idempotent). |
| Crash visibility | If client sees lock but port is dead — clear message: "server at <port> not responding (lock may be stale); try `vismd stop` then retry". |
| Shutdown signal | Server installs SIGTERM handler that calls `app.stop()` and deletes its own lock. |

### Browser-opening behavior

The client opens the browser to the resolved URL using the M1 `open` strategy (already implemented). When the server is reused, the open is immediate (no boot wait). When the server is freshly spawned, the client polls the lock until the server reports ready, then opens.

### What stays unchanged from M3

- All routes from M3 (index, `/<path>`, `/_mdx/<path>.mjs`, `/*` asset dispatcher).
- Asset dispatcher logic.
- Containment.
- Error surfacing (preflight, error block, `/_log` relay — daemon's stderr goes to log file, but `/_log` POSTs from browser still land there for postmortem).

### Open questions for M4 planning

1. **Lock file location**: `.vismd/server.json` per-project — gitignored by default? Probably yes; add to `.gitignore` automatically or just document.
2. **Log rotation**: unrotated for v0.x (user clears). Add `vismd logs --tail` and `vismd logs --clear` helpers? Lean yes for ergonomics.
3. **Server-side hot-reload of cwd changes**: if user adds a `.vis.mdx` while daemon runs, does the index pick it up? Per-request stat is already the rule (M3) — yes naturally.
4. **`vismd <file>` outside a known cwd**: client checks current cwd's lock. If file is outside any active server's cwd → spawn a new daemon for the file's project root? Lean error: "no running server in <cwd>; `vismd start` first."
5. **Multiple `vismd start` in different dirs of same monorepo**: each gets its own lock + port. Fine.
6. **Stop-all command**: `vismd stop-all` to kill every vismd daemon on the box (reads all known locks). Lean: skip for v1, add if asked.
7. **Bind host**: always `127.0.0.1` (no flag to override) to prevent accidental LAN exposure of a long-lived server.

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| Windows detachment quirks | Smoke-test on Windows before M4 ship. |
| Stale lock confuses client | Liveness check + clear "server not responding" message + suggest `vismd stop`. |
| Server crashes silently | Log file + crash hint in client when port unreachable. |
| Long-lived server attack surface | Bind 127.0.0.1 only; reject `Host:` headers not matching `127.0.0.1` or `localhost`. |
| Multiple servers eating ports | Auto-pick + lock means no collision; user can `vismd status` to inventory. |

---

## Combined sequencing

```
M2 (shipped) ─┐
              ├─→ M3 (multi-file foreground) ─→ M4 (background daemon)
              │       routes proven                 wraps M3 in lifecycle
              │
              └─ optional future: --root flag, frontmatter hints
                 (both deferred during M2 grill, both non-breaking)
```

Each milestone independently shippable. Stopping after any one leaves a coherent product.

## Out of scope for both

- HMR / file watching.
- `vismd doc` / `vismd check` commands.
- Multi-language support (Vue, Preact, Solid).
- Bundling / static export.
- Hosted/remote registry support beyond placeholder substitution.
- Authentication or any non-localhost binding.
