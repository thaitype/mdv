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
    const reportToCli = (label, err) => {
      try {
        const message = "[vismd] " + label + ": " + (err && err.message ? err.message : String(err));
        const stack = err && err.stack ? String(err.stack) : "";
        fetch("/_log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: "error", message: message, stack: stack }),
        }).catch(() => {});
      } catch { /* best-effort relay */ }
    };
    const showError = (label, err) => {
      console.error("[vismd]", label, err);
      reportToCli(label, err);
      // Prefer server-supplied error body (it has actionable detail like unresolved imports)
      let body = err && err.stack ? err.stack : String(err);
      if (err && typeof err.serverBody === "string" && err.serverBody) body = err.serverBody;
      root.innerHTML = "";
      const pre = document.createElement("pre");
      pre.style.cssText = "color:#b00;background:#fee;padding:1em;white-space:pre-wrap;font:12px/1.4 ui-monospace,monospace";
      pre.textContent = "[vismd] " + label + ":\\n" + body;
      root.appendChild(pre);
    };
    window.addEventListener("error", (e) => showError("uncaught error", e.error || e.message));
    window.addEventListener("unhandledrejection", (e) => showError("unhandled rejection", e.reason));
    try {
      // Pre-fetch the MDX module so we can surface the server's error body on non-2xx.
      // Dynamic import() collapses 4xx/5xx into an opaque "Failed to fetch" — we want detail.
      const mdxUrl = "/_mdx/${entryBasename}.mjs";
      const probe = await fetch(mdxUrl, { cache: "no-store" });
      if (!probe.ok) {
        const body = await probe.text();
        const err = new Error("MDX compile failed (" + probe.status + ")");
        err.serverBody = body;
        throw err;
      }
      const [{ createRoot }, react, mdxMod] = await Promise.all([
        import("react-dom/client"),
        import("react"),
        import(mdxUrl),
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
