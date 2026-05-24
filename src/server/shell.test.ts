import { describe, it, expect } from "vitest";
import { renderShell } from "./shell.js";

describe("renderShell", () => {
  it("starts with <!doctype html>", () => {
    const html = renderShell("example");
    expect(html.startsWith("<!doctype html>")).toBe(true);
  });

  it("contains import MDX from the correct mjs path", () => {
    const html = renderShell("example");
    expect(html).toContain('import MDX from "/_mdx/example.mjs"');
  });

  it("uses entryBasename (stripped of .vis.mdx) in title and script src", () => {
    // entryBasename derivation happens in app.ts; renderShell receives the already-stripped name
    // Verify that renderShell correctly uses the basename it receives
    const html = renderShell("intro");
    expect(html).toContain("<title>intro</title>");
    expect(html).toContain('import MDX from "/_mdx/intro.mjs"');
  });

  it("basename with no suffix remnant: intro.vis.mdx → intro produces correct mjs path", () => {
    // The basename passed to renderShell must already have .vis.mdx stripped
    // (stripping happens in app.ts via path.basename(entry).replace(/\.vis\.mdx$/, ""))
    // renderShell("intro") should NOT have "vis" or "mdx" in the script import path
    const html = renderShell("intro");
    expect(html).not.toContain("/_mdx/intro.vis.mjs");
    expect(html).toContain('/_mdx/intro.mjs"');
  });

  it("contains esm.sh react-dom@18/client", () => {
    const html = renderShell("example");
    expect(html).toContain("esm.sh/react-dom@18/client");
  });

  it("contains <div id=\"root\">", () => {
    const html = renderShell("example");
    expect(html).toContain('<div id="root"></div>');
  });

  it("does NOT contain a <link rel=stylesheet> tag", () => {
    const html = renderShell("example");
    expect(html).not.toMatch(/<link[^>]*stylesheet/i);
  });
});
