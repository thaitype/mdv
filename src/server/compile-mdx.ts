import * as fs from "node:fs/promises";
import * as path from "node:path";
import { compile } from "@mdx-js/mdx";
import { substitute } from "../placeholders.js";
import { resolveAsset } from "../resolve.js";

export interface CompileMdxInput {
  entryPath: string;  // absolute path to the .vis.mdx file (resolved at boot)
  cwd: string;        // absolute real path of working directory (for import preflight)
  local: string;
  registry: string;
}

export type ImportFailure = { url: string; lookedFor: string };

export type CompileMdxResult =
  | { kind: "ok"; code: string }
  | { kind: "not-found"; path: string }
  | { kind: "unknown-placeholder"; placeholder: string }
  | { kind: "unresolved-imports"; failures: ImportFailure[] }
  | { kind: "compile-error"; message: string };

export async function compileMdx(input: CompileMdxInput): Promise<CompileMdxResult> {
  const filePath = input.entryPath;

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

  // Preflight: scan for local URLs the browser will fetch, verify each resolves under cwd.
  // Catches the common "MDX expects a different cwd" footgun before the browser hits opaque
  // dynamic-import errors.
  const localUrls = findLocalUrlPaths(subResult.output, input.local);
  const failures: ImportFailure[] = [];
  for (const urlPath of localUrls) {
    const res = resolveAsset(urlPath, input.cwd);
    if (!res.ok) {
      failures.push({ url: urlPath, lookedFor: describeProbe(urlPath) });
    }
  }
  if (failures.length > 0) {
    return { kind: "unresolved-imports", failures };
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

/**
 * Extract URL *paths* from a source string for every absolute URL that points at the local
 * server. Deduplicated. The path is the part after `local`, e.g. for local=`http://127.0.0.1:5173`
 * and source containing `"http://127.0.0.1:5173/components/Hello"`, returns `["/components/Hello"]`.
 */
function findLocalUrlPaths(source: string, local: string): string[] {
  const escaped = local.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}(/[^\\s"'\`)]*)`, "g");
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    out.add(m[1]);
  }
  return [...out];
}

/**
 * Human-readable description of what the resolver would search for a given URL path.
 * Used in the error body to make it actionable.
 */
function describeProbe(urlPath: string): string {
  const ext = path.extname(urlPath);
  const rel = urlPath.replace(/^\//, "");
  if (ext === ".css") return `${rel}`;
  if (ext === ".mjs") return `${rel.slice(0, -".mjs".length)}.{tsx,ts,jsx,js}`;
  if (ext === "") return `${rel}.{tsx,ts,jsx,js}`;
  return `${rel} (unknown extension)`;
}
