import { describe, it, expect } from "vitest";
import { renderShell } from "./shell.js";

describe("renderShell", () => {
  const html = renderShell("example");

  it("starts with <!doctype html>", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
  });

  it("contains import MDX from the correct mjs path", () => {
    expect(html).toContain('import MDX from "/_mdx/example.mjs"');
  });

  it("contains esm.sh react-dom@18/client", () => {
    expect(html).toContain("esm.sh/react-dom@18/client");
  });

  it("contains <div id=\"root\">", () => {
    expect(html).toContain('<div id="root"></div>');
  });

  it("does NOT contain a <link rel=stylesheet> tag", () => {
    expect(html).not.toMatch(/<link[^>]*stylesheet/i);
  });
});
