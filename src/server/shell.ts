export function renderShell(entryBasename: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${entryBasename}</title>
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18",
      "react/jsx-runtime": "https://esm.sh/react@18/jsx-runtime",
      "react/jsx-dev-runtime": "https://esm.sh/react@18/jsx-dev-runtime",
      "react-dom": "https://esm.sh/react-dom@18?external=react",
      "react-dom/client": "https://esm.sh/react-dom@18/client?external=react"
    }
  }
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import { createRoot } from "react-dom/client"
    import MDX from "/_mdx/${entryBasename}.mjs"
    createRoot(document.getElementById("root")).render(MDX())
  </script>
</body>
</html>`;
}
