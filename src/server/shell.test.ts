import { describe, it, expect } from "vitest";
import { renderShell } from "./shell.js";

describe("renderShell", () => {
  it("starts with <!doctype html>", () => {
    const html = renderShell("example");
    expect(html.startsWith("<!doctype html>")).toBe(true);
  });

  it("imports MDX from the correct mjs path", () => {
    const html = renderShell("example");
    expect(html).toContain('"/_mdx/example.mjs"');
  });

  it("uses entryBasename (stripped of .vis.mdx) in title and script src", () => {
    const html = renderShell("intro");
    expect(html).toContain("<title>intro</title>");
    expect(html).toContain('"/_mdx/intro.mjs"');
  });

  it("basename with no suffix remnant: intro.vis.mdx → intro produces correct mjs path", () => {
    const html = renderShell("intro");
    expect(html).not.toContain("/_mdx/intro.vis.mjs");
    expect(html).toContain('"/_mdx/intro.mjs"');
  });

  it("contains esm.sh react-dom@18/client", () => {
    const html = renderShell("example");
    expect(html).toContain("esm.sh/react-dom@18/client");
  });

  it("contains a #root container", () => {
    const html = renderShell("example");
    expect(html).toMatch(/<div\s+id="root"/);
  });

  it("does NOT contain a <link rel=stylesheet> tag", () => {
    const html = renderShell("example");
    expect(html).not.toMatch(/<link[^>]*stylesheet/i);
  });
});
