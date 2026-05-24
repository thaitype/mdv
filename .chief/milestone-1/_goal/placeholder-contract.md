# Goal: Placeholder authoring contract

## Outcome

MDX files authored for `vismd` are portable across machines because they reference assets via placeholder URLs, not filesystem paths. `vismd` substitutes placeholders at request time before compiling MDX. The same `.mdx` file works on any developer's machine without edits.

## The contract

Two placeholders are recognized:

| Placeholder | Substituted to | Source |
|---|---|---|
| `{{VISMD_LOCAL}}` | `http://<host>:<port>` of the running vismd server | Computed at boot from `--host` and the actual bound port |
| `{{VISMD_REGISTRY}}` | Registry base URL | `process.env.VISMD_REGISTRY ?? "https://vismd.thaitype.dev"` |

## Substitution rules

1. Substitution applies to the **entire MDX source string** before it is passed to the MDX compiler. It is not limited to `import` statements — `<link>` hrefs, `<script src>`, and any other string occurrence are substituted.
2. Substitution is **case-sensitive**. `{{VISMD_LOCAl}}` is treated as an unknown placeholder, not a typo to silently fix.
3. After substituting all known placeholders, vismd scans the result for any remaining `{{...}}` pattern. If any remain, the route fails loud:
   - HTTP status: **500**.
   - Content-Type: `text/plain`.
   - Body: `Unknown placeholder: {{VISMD_FOO}}` (where `{{VISMD_FOO}}` is the first unknown one found).
4. Substitution happens at every request to `GET /_mdx/<name>.mjs`; there is no caching in milestone-1.

## Author-visible examples

```mdx
import Diagram from "{{VISMD_LOCAL}}/Diagram"
import Chart   from "{{VISMD_REGISTRY}}/chart@1.0.0/Chart"

<link rel="stylesheet" href="{{VISMD_LOCAL}}/styles.css" />

# Title

<Diagram>{`flowchart LR\n  A --> B`}</Diagram>
<Chart data={[1, 2, 3]} />
```

The component file `./components/Diagram.tsx` is served at `http://<host>:<port>/Diagram.mjs` (with the `.mjs` extension appended by the browser-side import resolution, because vismd serves the transformed module under the bare component name + `.mjs`).

## Why this matters

This contract is the load-bearing reason `vismd` exists. AI-generated MDX referencing components is portable iff the URLs do not encode any local filesystem detail. The placeholder is the seam. Any change to placeholder syntax or substitution behavior is a breaking change to every existing `.mdx` file in the wild.
