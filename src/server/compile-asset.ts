import * as fs from "node:fs/promises";
import * as esbuild from "esbuild";

export interface CompileAssetInput {
  diskPath: string;
}

export type CompileAssetResult =
  | { kind: "ok"; code: string }
  | { kind: "transform-error"; message: string };

export async function compileAsset(input: CompileAssetInput): Promise<CompileAssetResult> {
  const source = await fs.readFile(input.diskPath, "utf-8");

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
