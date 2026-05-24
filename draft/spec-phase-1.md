# @thaitype/mdv — MVP Design Spec

## Goal
CLI that serves MDX files in the browser by compiling on-the-fly,
substituting `{{MDV_LOCAL}}`/`{{MDV_REGISTRY}}` placeholders at request time.

## Decisions

- **Q1: `mdv check` prop validation** → Skip. Syntax + import resolution only.
  Type errors surface in the browser at runtime.
- **Q2: `mdv check` remote URL validation** → Skip. Only local path existence
  is checked. `check` is fully offline/synchronous.
- **Q3: Default registry URL** → `process.env.MDV_REGISTRY ?? "https://mdv.thaitype.dev"`.
  No CLI flag in v0.1.
- **Q4: Unknown placeholder error format** → 500 plain text:
  `Unknown placeholder: {{MDV_UNKNOWN}}`.
- **Q5: `mdv check` exit codes** → 0 = pass, 1 = any failure.

## Open Questions (Parked)

- [ ] **tsup shebang per entry** — does tsup support per-entry `banner`
  natively, or is a post-build step needed to add shebang only to `dist/cli.js`?
