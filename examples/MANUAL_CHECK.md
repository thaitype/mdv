# Manual Browser Check

Follow these steps to verify the vismd dev server works end-to-end in your browser.

## Prerequisites

- Node.js >= 20
- pnpm installed

```bash
pnpm install
pnpm run build
```

## Run the example

```bash
cd examples && node ../dist/cli.js example.vis.mdx
```

Or, from the project root:

```bash
node dist/cli.js examples/example.vis.mdx
```

Note: the server must be invoked with `examples/` as the working directory (or with a path that resolves inside it) because cwd is the root for all asset requests.

## What you should see in the terminal

Before the server binds, it prints two lines to **stderr**:

```
vismd: working directory: /path/to/mdv/examples
vismd: serving example.vis.mdx
```

After binding, it prints one line to **stdout** (the URL):

```
http://127.0.0.1:<port>
```

The working-directory line is useful for confirming which root is used to resolve imports.

## What you should see in the browser

- A heading **"Hi"** — the plain markdown heading from `example.vis.mdx`.
- A greeting **"Hello, world!"** in tomato color — the `<Hello name="world" />` JSX component rendered via `components/Hello.tsx`.
- The tomato color on the greeting text confirms that `styles/main.css` was loaded correctly from the `<link>` tag in `example.vis.mdx`.

## Try editing

1. Open `examples/example.vis.mdx` in your editor.
2. Change the text (e.g., change the heading or `name="world"` to something else).
3. Save the file and **manually refresh** the browser tab.

Note: milestone-2 has no HMR. A manual reload is expected and correct.

## What to check if it breaks

1. Run the automated smoke test first:

   ```bash
   pnpm smoke
   ```

   This builds the project and runs all route checks automatically. If it prints `[smoke] OK (10/10 checks)`, the server is working correctly and the issue is likely browser-specific.

2. Check the terminal for stderr messages from `vismd` — errors reading the MDX file or assets are printed there.

3. Check the browser's DevTools network tab for 404/500 responses on script or CSS URLs.
