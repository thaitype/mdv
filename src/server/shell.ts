export function renderShell(entryBasename: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${entryBasename}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import { createRoot } from "https://esm.sh/react-dom@18/client"
    import MDX from "/_mdx/${entryBasename}.mjs"
    createRoot(document.getElementById("root")).render(MDX())
  </script>
</body>
</html>`;
}
