# Goal: Placeholder authoring contract

## Outcome

MDX files authored for `mdv` are portable across machines because they reference assets via placeholder URLs, not filesystem paths. `mdv` substitutes placeholders at request time before compiling MDX. The same `.mdx` file works on any developer's machine without edits.

## The contract

Two placeholders are recognized:

| Placeholder | Substituted to | Source |
|---|---|---|
| `{{MDV_LOCAL}}` | `http://<host>:<port>` of the running mdv server | Computed at boot from `--host` and the actual bound port |
| `{{MDV_REGISTRY}}` | Registry base URL | `process.env.MDV_REGISTRY ?? "https://mdv.thaitype.dev"` |

## Substitution rules

1. Substitution applies to the **entire MDX source string** before it is passed to the MDX compiler. It is not limited to `import` statements — `<link>` hrefs, `<script src>`, and any other string occurrence are substituted.
2. Substitution is **case-sensitive**. `{{MDV_LOCAl}}` is treated as an unknown placeholder, not a typo to silently fix.
3. After substituting all known placeholders, mdv scans the result for any remaining `{{...}}` pattern. If any remain, the route fails loud:
   - HTTP status: **500**.
   - Content-Type: `text/plain`.
   - Body: `Unknown placeholder: {{MDV_FOO}}` (where `{{MDV_FOO}}` is the first unknown one found).
4. Substitution happens at every request to `GET /_mdx/<name>.mjs`; there is no caching in milestone-1.

## Author-visible examples

```mdx
import Diagram from "{{MDV_LOCAL}}/Diagram"
import Chart   from "{{MDV_REGISTRY}}/chart@1.0.0/Chart"

<link rel="stylesheet" href="{{MDV_LOCAL}}/styles.css" />

# Title

<Diagram>{`flowchart LR\n  A --> B`}</Diagram>
<Chart data={[1, 2, 3]} />
```

The component file `./components/Diagram.tsx` is served at `http://<host>:<port>/Diagram.mjs` (with the `.mjs` extension appended by the browser-side import resolution, because mdv serves the transformed module under the bare component name + `.mjs`).

## Why this matters

This contract is the load-bearing reason `mdv` exists. AI-generated MDX referencing components is portable iff the URLs do not encode any local filesystem detail. The placeholder is the seam. Any change to placeholder syntax or substitution behavior is a breaking change to every existing `.mdx` file in the wild.
