import * as fs from "node:fs/promises";
import * as esbuild from "esbuild";
import { resolveComponent } from "../resolve.js";

export interface CompileAssetInput {
  assetsDir: string;
  componentName: string;
}

export type CompileAssetResult =
  | { kind: "ok"; code: string }
  | { kind: "not-found"; name: string }
  | { kind: "transform-error"; message: string };

export async function compileAsset(input: CompileAssetInput): Promise<CompileAssetResult> {
  const resolved = resolveComponent(input.assetsDir, input.componentName);
  if (resolved === null) {
    return { kind: "not-found", name: input.componentName };
  }

  const source = await fs.readFile(resolved, "utf-8");

  try {
    const result = await esbuild.transform(source, {
      loader: "tsx",
      jsx: "automatic",
      jsxImportSource: "react",
      format: "esm",
      sourcemap: "inline",
    });
    return { kind: "ok", code: result.code };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: "transform-error", message };
  }
}
