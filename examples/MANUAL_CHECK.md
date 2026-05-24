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
node dist/cli.js examples/example.mdx --assets examples/components
```

The server will print the URL to stdout (e.g. `http://127.0.0.1:<port>`) and open your default browser automatically.

## What you should see

- A heading **"Hi"** — the plain markdown heading from `example.mdx`.
- A greeting **"Hello, world!"** in tomato color — the `<Hello name="world" />` JSX component rendered via `Hello.tsx`.
- The tomato color on the greeting text confirms that `styles.css` was loaded correctly from the `<link>` tag in `example.mdx`.

## Try editing

1. Open `examples/example.mdx` in your editor.
2. Change the text (e.g., change the heading or `name="world"` to something else).
3. Save the file and **manually refresh** the browser tab.

Note: milestone-1 has no HMR. A manual reload is expected and correct.

## What to check if it breaks

1. Run the automated smoke test first:

   ```bash
   pnpm smoke
   ```

   This builds the project and runs all route checks automatically. If it prints `[smoke] OK (6/6 checks)`, the server is working correctly and the issue is likely browser-specific.

2. Check the terminal for stderr messages from `vismd` — errors reading the MDX file or assets are printed there.

3. Check the browser's DevTools network tab for 404/500 responses on script or CSS URLs.
