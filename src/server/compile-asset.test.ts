import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { compileAsset } from "./compile-asset.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mdv-compile-asset-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("compileAsset", () => {
  it("tsx file with simple React component compiles ok", async () => {
    const tsx = `
import React from "react";
export default function Hello() {
  return <div>Hello</div>;
}
`;
    await fs.writeFile(path.join(tmpDir, "Hello.tsx"), tsx);
    const result = await compileAsset({ assetsDir: tmpDir, componentName: "Hello" });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.code.length).toBeGreaterThan(0);
    }
  });

  it("bad tsx syntax returns kind=transform-error", async () => {
    await fs.writeFile(path.join(tmpDir, "Bad.tsx"), "export default function Bad() { <<< }");
    const result = await compileAsset({ assetsDir: tmpDir, componentName: "Bad" });
    expect(result.kind).toBe("transform-error");
    if (result.kind === "transform-error") {
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it("missing component returns kind=not-found", async () => {
    const result = await compileAsset({ assetsDir: tmpDir, componentName: "Missing" });
    expect(result.kind).toBe("not-found");
    if (result.kind === "not-found") {
      expect(result.name).toBe("Missing");
    }
  });
});
