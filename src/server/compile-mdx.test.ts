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
      cwd: tmpDir,
      local: "http://127.0.0.1:5173",
      registry: "https://vismd.thaitype.dev",
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.code.length).toBeGreaterThan(0);
    }
  });

  it("placeholder substitution: VISMD_LOCAL is replaced in compiled output", async () => {
    // Create the referenced source so the import preflight passes
    await fs.writeFile(path.join(tmpDir, "X.tsx"), "export default () => null;");
    const mdx = `import X from "{{VISMD_LOCAL}}/X"\n\n# Test\n`;
    const entryPath = path.join(tmpDir, "sub.vis.mdx");
    await fs.writeFile(entryPath, mdx);
    const result = await compileMdx({
      entryPath,
      cwd: tmpDir,
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
      cwd: tmpDir,
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
      cwd: tmpDir,
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
      cwd: tmpDir,
      local: "http://127.0.0.1:5173",
      registry: "https://vismd.thaitype.dev",
    });
    expect(result.kind).toBe("compile-error");
    if (result.kind === "compile-error") {
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it("basename derivation: stripping .vis.mdx from filename, not .mdx", async () => {
    const entryPath = path.join(tmpDir, "intro.vis.mdx");
    await fs.writeFile(entryPath, "# Intro\n");
    const result = await compileMdx({
      entryPath,
      cwd: tmpDir,
      local: "http://127.0.0.1:5173",
      registry: "https://vismd.thaitype.dev",
    });
    expect(result.kind).toBe("ok");
  });

  it("unresolved imports: returns kind=unresolved-imports listing each missing url", async () => {
    const mdx = `import A from "{{VISMD_LOCAL}}/components/A"\nimport B from "{{VISMD_LOCAL}}/components/B"\n<link rel="stylesheet" href="{{VISMD_LOCAL}}/missing.css" />\n\n# Test\n`;
    const entryPath = path.join(tmpDir, "broken.vis.mdx");
    await fs.writeFile(entryPath, mdx);
    const result = await compileMdx({
      entryPath,
      cwd: tmpDir,
      local: "http://127.0.0.1:5173",
      registry: "https://vismd.thaitype.dev",
    });
    expect(result.kind).toBe("unresolved-imports");
    if (result.kind === "unresolved-imports") {
      const urls = result.failures.map((f) => f.url).sort();
      expect(urls).toEqual(["/components/A", "/components/B", "/missing.css"]);
      const a = result.failures.find((f) => f.url === "/components/A");
      expect(a?.lookedFor).toContain("components/A.{tsx,ts,jsx,js}");
      const css = result.failures.find((f) => f.url === "/missing.css");
      expect(css?.lookedFor).toBe("missing.css");
    }
  });

  it("registry URLs are NOT preflighted (only local-base URLs)", async () => {
    const mdx = `import X from "{{VISMD_REGISTRY}}/chart@1.0.0/Chart"\n\n# Test\n`;
    const entryPath = path.join(tmpDir, "reg.vis.mdx");
    await fs.writeFile(entryPath, mdx);
    const result = await compileMdx({
      entryPath,
      cwd: tmpDir,
      local: "http://127.0.0.1:5173",
      registry: "https://vismd.thaitype.dev",
    });
    expect(result.kind).toBe("ok");
  });
});
