import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveComponent, resolveCss } from "./resolve.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vismd-resolve-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("resolveComponent", () => {
  it("resolves a .tsx file when present", () => {
    const file = path.join(tmpDir, "Diagram.tsx");
    fs.writeFileSync(file, "export default function Diagram() {}");
    expect(resolveComponent(tmpDir, "Diagram")).toBe(file);
  });

  it("prefers .tsx over .ts when both exist", () => {
    const tsx = path.join(tmpDir, "Chart.tsx");
    const ts = path.join(tmpDir, "Chart.ts");
    fs.writeFileSync(tsx, "export default function Chart() {}");
    fs.writeFileSync(ts, "export default function Chart() {}");
    expect(resolveComponent(tmpDir, "Chart")).toBe(tsx);
  });

  it("falls through to .ts when only .ts exists", () => {
    const ts = path.join(tmpDir, "Chart.ts");
    fs.writeFileSync(ts, "export default function Chart() {}");
    expect(resolveComponent(tmpDir, "Chart")).toBe(ts);
  });

  it("returns null when component does not exist in any extension", () => {
    expect(resolveComponent(tmpDir, "Missing")).toBeNull();
  });

  it("returns null for path traversal using ..", () => {
    expect(resolveComponent(tmpDir, "../etc/passwd")).toBeNull();
  });

  it("returns null for path traversal using a slash in name", () => {
    expect(resolveComponent(tmpDir, "sub/Component")).toBeNull();
  });
});

describe("resolveCss", () => {
  it("returns absolute path when css file exists", () => {
    const file = path.join(tmpDir, "styles.css");
    fs.writeFileSync(file, "body { color: red; }");
    expect(resolveCss(tmpDir, "styles.css")).toBe(file);
  });

  it("returns null when css file does not exist", () => {
    expect(resolveCss(tmpDir, "missing.css")).toBeNull();
  });

  it("returns null for path traversal using ..", () => {
    expect(resolveCss(tmpDir, "../etc/passwd")).toBeNull();
  });
});
