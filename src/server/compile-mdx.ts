import * as fs from "node:fs/promises";
import * as path from "node:path";
import { compile } from "@mdx-js/mdx";
import { substitute } from "../placeholders.js";

export interface CompileMdxInput {
  entryDir: string;
  entryName: string;
  local: string;
  registry: string;
}

export type CompileMdxResult =
  | { kind: "ok"; code: string }
  | { kind: "not-found"; path: string }
  | { kind: "unknown-placeholder"; placeholder: string }
  | { kind: "compile-error"; message: string };

export async function compileMdx(input: CompileMdxInput): Promise<CompileMdxResult> {
  const filePath = path.resolve(input.entryDir, input.entryName + ".mdx");

  let source: string;
  try {
    source = await fs.readFile(filePath, "utf-8");
  } catch {
    return { kind: "not-found", path: filePath };
  }

  const subResult = substitute(source, { local: input.local, registry: input.registry });
  if (!subResult.ok) {
    return { kind: "unknown-placeholder", placeholder: subResult.unknown };
  }

  try {
    const result = await compile(subResult.output, {
      jsxImportSource: "react",
      outputFormat: "program",
      development: true,
    });
    return { kind: "ok", code: String(result) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: "compile-error", message };
  }
}
