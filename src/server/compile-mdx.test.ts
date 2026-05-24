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
  it("happy path: tiny mdx with no placeholders compiles ok", async () => {
    await fs.writeFile(path.join(tmpDir, "hello.mdx"), "# Hello\n\nWorld\n");
    const result = await compileMdx({
      entryDir: tmpDir,
      entryName: "hello",
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
    await fs.writeFile(path.join(tmpDir, "sub.mdx"), mdx);
    const result = await compileMdx({
      entryDir: tmpDir,
      entryName: "sub",
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
    await fs.writeFile(path.join(tmpDir, "unknown.mdx"), mdx);
    const result = await compileMdx({
      entryDir: tmpDir,
      entryName: "unknown",
      local: "http://127.0.0.1:5173",
      registry: "https://vismd.thaitype.dev",
    });
    expect(result.kind).toBe("unknown-placeholder");
    if (result.kind === "unknown-placeholder") {
      expect(result.placeholder).toBe("{{VISMD_FOO}}");
    }
  });

  it("file missing: returns kind=not-found", async () => {
    const result = await compileMdx({
      entryDir: tmpDir,
      entryName: "nonexistent",
      local: "http://127.0.0.1:5173",
      registry: "https://vismd.thaitype.dev",
    });
    expect(result.kind).toBe("not-found");
    if (result.kind === "not-found") {
      expect(result.path).toContain("nonexistent.mdx");
    }
  });

  it("bad mdx syntax: returns kind=compile-error with non-empty message", async () => {
    await fs.writeFile(path.join(tmpDir, "bad.mdx"), "<<<\n");
    const result = await compileMdx({
      entryDir: tmpDir,
      entryName: "bad",
      local: "http://127.0.0.1:5173",
      registry: "https://vismd.thaitype.dev",
    });
    expect(result.kind).toBe("compile-error");
    if (result.kind === "compile-error") {
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});
