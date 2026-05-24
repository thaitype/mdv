# @vismd/cli — MVP Design Spec

## Goal
CLI that serves MDX files in the browser by compiling on-the-fly,
substituting `{{VISMD_LOCAL}}`/`{{VISMD_REGISTRY}}` placeholders at request time.

## Decisions

- **Q1: `vismd check` prop validation** → Skip. Syntax + import resolution only.
  Type errors surface in the browser at runtime.
- **Q2: `vismd check` remote URL validation** → Skip. Only local path existence
  is checked. `check` is fully offline/synchronous.
- **Q3: Default registry URL** → `process.env.VISMD_REGISTRY ?? "https://vismd.thaitype.dev"`.
  No CLI flag in v0.1.
- **Q4: Unknown placeholder error format** → 500 plain text:
  `Unknown placeholder: {{VISMD_UNKNOWN}}`.
- **Q5: `vismd check` exit codes** → 0 = pass, 1 = any failure.

## Open Questions (Parked)

- [ ] **tsup shebang per entry** — does tsup support per-entry `banner`
  natively, or is a post-build step needed to add shebang only to `dist/cli.js`?
