import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { compileMdx } from "./compile-mdx.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vismd-compile-mdx-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("compileMdx", () => {
  it("happy path: tiny .vis.mdx with no placeholders compiles ok", async () => {
    const entryPath = path.join(tmpDir, "hello.vis.mdx");
    await fs.writeFile(entryPath, "# Hello\n\nWorld\n");
    const result = await compileMdx({
      entryPath,
      local: "http://127.0.0.1:5173",
      registry: "https://vismd.thaitype.dev",
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.code.length).toBeGreaterThan(0);
    }
  });

  it("placeholder substitution: VISMD_LOCAL is replaced in compiled output", async () => {
    const mdx = `import X from "{{VISMD_LOCAL}}/X"\n\n# Test\n`;
    const entryPath = path.join(tmpDir, "sub.vis.mdx");
    await fs.writeFile(entryPath, mdx);
    const result = await compileMdx({
      entryPath,
      local: "http://127.0.0.1:5173",
      registry: "https://vismd.thaitype.dev",
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.code).toContain("http://127.0.0.1:5173/X");
    }
  });

  it("unknown placeholder: returns kind=unknown-placeholder with the placeholder", async () => {
    const mdx = `# Test\n\n{{VISMD_FOO}}\n`;
    const entryPath = path.join(tmpDir, "unknown.vis.mdx");
    await fs.writeFile(entryPath, mdx);
    const result = await compileMdx({
      entryPath,
      local: "http://127.0.0.1:5173",
      registry: "https://vismd.thaitype.dev",
    });
    expect(result.kind).toBe("unknown-placeholder");
    if (result.kind === "unknown-placeholder") {
      expect(result.placeholder).toBe("{{VISMD_FOO}}");
    }
  });

  it("file missing: returns kind=not-found", async () => {
    const entryPath = path.join(tmpDir, "nonexistent.vis.mdx");
    const result = await compileMdx({
      entryPath,
      local: "http://127.0.0.1:5173",
      registry: "https://vismd.thaitype.dev",
    });
    expect(result.kind).toBe("not-found");
    if (result.kind === "not-found") {
      expect(result.path).toContain("nonexistent.vis.mdx");
    }
  });

  it("bad mdx syntax: returns kind=compile-error with non-empty message", async () => {
    const entryPath = path.join(tmpDir, "bad.vis.mdx");
    await fs.writeFile(entryPath, "<<<\n");
    const result = await compileMdx({
      entryPath,
      local: "http://127.0.0.1:5173",
      registry: "https://vismd.thaitype.dev",
    });
    expect(result.kind).toBe("compile-error");
    if (result.kind === "compile-error") {
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it("basename derivation: stripping .vis.mdx from filename, not .mdx", async () => {
    // File named intro.vis.mdx should resolve correctly by entryPath
    const entryPath = path.join(tmpDir, "intro.vis.mdx");
    await fs.writeFile(entryPath, "# Intro\n");
    const result = await compileMdx({
      entryPath,
      local: "http://127.0.0.1:5173",
      registry: "https://vismd.thaitype.dev",
    });
    // compileMdx reads from the absolute path directly; basename derivation is in app.ts
    expect(result.kind).toBe("ok");
  });
});
