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
  <div id="root">loading…</div>
  <script type="module">
    const root = document.getElementById("root");
    const showError = (label, err) => {
      console.error("[vismd]", label, err);
      root.innerHTML = "";
      const pre = document.createElement("pre");
      pre.style.cssText = "color:#b00;background:#fee;padding:1em;white-space:pre-wrap;font:12px/1.4 ui-monospace,monospace";
      pre.textContent = "[vismd] " + label + ":\\n" + (err && err.stack ? err.stack : String(err));
      root.appendChild(pre);
    };
    window.addEventListener("error", (e) => showError("uncaught error", e.error || e.message));
    window.addEventListener("unhandledrejection", (e) => showError("unhandled rejection", e.reason));
    try {
      const [{ createRoot }, react, mdxMod] = await Promise.all([
        import("react-dom/client"),
        import("react"),
        import("/_mdx/${entryBasename}.mjs"),
      ]);
      const MDX = mdxMod.default;
      createRoot(root).render(react.createElement(MDX));
    } catch (err) {
      showError("boot failed", err);
    }
  </script>
</body>
</html>`;
}
