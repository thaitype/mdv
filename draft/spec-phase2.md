# vismd — Design Spec Phase 2

**Status:** Draft
**Date:** 2026-05-24

Covers only changes from Phase 1. All other Phase 1 decisions stand.

## Changes

- Project renamed from `mdv` to `vismd` (visual + md). Package: `@vismd/cli`. Binary: `vismd`.
- Remove `--assets` flag entirely.
- Server working directory is declared per-file via YAML frontmatter.
- Imports use real paths relative to the declared working directory.
- `..` allowed in import paths, but resolved path must stay inside the working directory.

## Frontmatter syntax

```mdx
---
vismd:
  working_directory: ../
---

import Diagram from "{{VISMD_LOCAL}}/components/Diagram"

<Diagram />
```

- `working_directory` is relative to the MDX file's location.
- `..` allowed in the value (e.g. MDX in `docs/` can declare `../` to point at project root).
- Default if frontmatter missing or key absent: `./` (same dir as MDX file).

## Placeholder rename

- `{{MDV_LOCAL}}` → `{{VISMD_LOCAL}}`
- `{{MDV_REGISTRY}}` → `{{VISMD_REGISTRY}}`

## Path resolution rules

- Server root = MDX file dir + `working_directory` value, resolved to absolute path.
- Imports starting with `{{VISMD_LOCAL}}/` resolve relative to server root.
- `..` segments inside import paths allowed during resolution.
- After resolution, real path must be contained inside server root (use `fs.realpath` then containment check).
- Reject: absolute paths, home expansion (`~`), dotfiles, symlinks escaping server root.

## On startup

- Parse frontmatter, resolve working directory, print to stdout: `Working directory: /absolute/path`.
- If frontmatter has invalid `vismd` block or malformed YAML, fail with clear error.

## Open questions

1. **Frontmatter parser**: `gray-matter` (~1MB, popular)
2. **Frontmatter required or optional**: if missing entirely, default `./` silently OR warn in stderr? Leaning silent default + always print resolved working dir.
3. **Other frontmatter keys**: reserve `vismd:` namespace for future config (e.g. `vismd: { registry: ..., title: ... }`)? Other top-level keys (`title`, `description`) ignored by vismd, pass through to MDX?
4. **MDX renderer behavior**: does `@mdx-js/mdx` need `remark-frontmatter` plugin to skip frontmatter during compile, or strip frontmatter before passing to compile? Leaning strip-before-compile (simpler, no plugin dependency).
5. **Max depth for `..` in working_directory**: cap at 3 levels up by default? Or unlimited as long as containment passes? Leaning unlimited (containment check is what matters, not depth).
6. **Error format when path escapes server root**: include both the import path and the resolved absolute path in error message? Yes for `vismd check`, but for browser 500 response — include absolute paths or hide for security? Leaning hide absolute paths in browser, show in CLI errors.
