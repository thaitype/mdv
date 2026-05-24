import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveAsset } from "./resolve.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vismd-resolve-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("resolveAsset — .mjs", () => {
  it("resolves a .tsx source when present", () => {
    const file = path.join(tmpDir, "Diagram.tsx");
    fs.writeFileSync(file, "export default function Diagram() {}");
    const result = resolveAsset("/Diagram.mjs", tmpDir);
    expect(result).toEqual({ ok: true, kind: "mjs", diskPath: file });
  });

  it("prefers .tsx over .ts when both exist", () => {
    const tsx = path.join(tmpDir, "Chart.tsx");
    const ts = path.join(tmpDir, "Chart.ts");
    fs.writeFileSync(tsx, "export default function Chart() {}");
    fs.writeFileSync(ts, "export default function Chart() {}");
    const result = resolveAsset("/Chart.mjs", tmpDir);
    expect(result).toEqual({ ok: true, kind: "mjs", diskPath: tsx });
  });

  it("falls through to .ts when only .ts exists", () => {
    const ts = path.join(tmpDir, "Chart.ts");
    fs.writeFileSync(ts, "export default function Chart() {}");
    const result = resolveAsset("/Chart.mjs", tmpDir);
    expect(result).toEqual({ ok: true, kind: "mjs", diskPath: ts });
  });

  it("resolves nested paths", () => {
    fs.mkdirSync(path.join(tmpDir, "components"));
    const file = path.join(tmpDir, "components", "Hello.tsx");
    fs.writeFileSync(file, "export default function Hello() {}");
    const result = resolveAsset("/components/Hello.mjs", tmpDir);
    expect(result).toEqual({ ok: true, kind: "mjs", diskPath: file });
  });

  it("returns { ok: false } when no source extension matches", () => {
    const result = resolveAsset("/Missing.mjs", tmpDir);
    expect(result).toEqual({ ok: false });
  });
});

describe("resolveAsset — .css", () => {
  it("returns the disk path when the css file exists", () => {
    const file = path.join(tmpDir, "styles.css");
    fs.writeFileSync(file, "body { color: red; }");
    const result = resolveAsset("/styles.css", tmpDir);
    expect(result).toEqual({ ok: true, kind: "css", diskPath: file });
  });

  it("returns { ok: false } when css file does not exist", () => {
    const result = resolveAsset("/missing.css", tmpDir);
    expect(result).toEqual({ ok: false });
  });

  it("resolves nested css paths", () => {
    fs.mkdirSync(path.join(tmpDir, "styles"));
    const file = path.join(tmpDir, "styles", "main.css");
    fs.writeFileSync(file, "body {}");
    const result = resolveAsset("/styles/main.css", tmpDir);
    expect(result).toEqual({ ok: true, kind: "css", diskPath: file });
  });
});

describe("resolveAsset — .. rejection", () => {
  it("rejects urlPath containing .. for .mjs", () => {
    const result = resolveAsset("/../etc/passwd.mjs", tmpDir);
    expect(result).toEqual({ ok: false });
  });

  it("rejects urlPath containing .. for .css", () => {
    const result = resolveAsset("/../etc/passwd.css", tmpDir);
    expect(result).toEqual({ ok: false });
  });

  it("rejects urlPath with embedded .. segment", () => {
    const result = resolveAsset("/foo/../bar.mjs", tmpDir);
    expect(result).toEqual({ ok: false });
  });
});

describe("resolveAsset — unknown extension", () => {
  it("returns { ok: false } for .png", () => {
    const result = resolveAsset("/image.png", tmpDir);
    expect(result).toEqual({ ok: false });
  });

  it("returns { ok: false } for no extension", () => {
    const result = resolveAsset("/noext", tmpDir);
    expect(result).toEqual({ ok: false });
  });

  it("returns { ok: false } for .html", () => {
    const result = resolveAsset("/index.html", tmpDir);
    expect(result).toEqual({ ok: false });
  });
});

describe("resolveAsset — symlink escape", () => {
  it("returns { ok: false } for a symlink that targets outside cwd", () => {
    // Create a file outside tmpDir
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "vismd-outside-"));
    const outsideFile = path.join(outsideDir, "secret.tsx");
    fs.writeFileSync(outsideFile, "export const secret = 42;");

    // Create a symlink inside tmpDir pointing to the outside file
    const symlinkPath = path.join(tmpDir, "escaped.tsx");
    fs.symlinkSync(outsideFile, symlinkPath);

    const result = resolveAsset("/escaped.mjs", tmpDir);
    expect(result).toEqual({ ok: false });

    fs.rmSync(outsideDir, { recursive: true, force: true });
  });
});
