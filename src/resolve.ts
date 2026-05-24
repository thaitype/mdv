import * as fs from "node:fs";
import * as path from "node:path";

const MJS_SOURCE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"] as const;

export type ResolveResult =
  | { ok: true; kind: "mjs" | "css"; diskPath: string }
  | { ok: false };

/**
 * Resolve a URL path to a disk file under cwd.
 *
 * Rules:
 * - Reject if urlPath contains any ".." segment (before any disk access).
 * - For ".mjs" OR no extension: strip extension (if any), probe <cwd>/<stripped>.{tsx,ts,jsx,js} in order; first existing wins.
 *   (Bare-name imports are supported because esbuild emits literal URLs from MDX source; authors write
 *    `import X from "{{VISMD_LOCAL}}/components/X"` without a `.mjs` suffix.)
 * - For ".css": exact match <cwd>/<stripped>.css.
 * - For any other extension: unresolvable.
 * - After picking a candidate, realpath it and verify it starts with realpath(cwd) + path.sep.
 * - On any failure, return { ok: false }.
 */
export function resolveAsset(urlPath: string, cwd: string): ResolveResult {
  // Reject ".." segments (pre-resolution, before any disk access)
  const segments = urlPath.split("/");
  if (segments.some((s) => s === "..")) {
    return { ok: false };
  }

  const ext = path.extname(urlPath);

  if (ext === ".mjs" || ext === "") {
    // Strip leading "/" and ".mjs" (if present) to get the relative path without extension
    const stripped = ext === ".mjs" ? urlPath.slice(0, -".mjs".length) : urlPath;
    const relative = stripped.replace(/^\//, "");

    if (relative === "") {
      return { ok: false };
    }

    for (const srcExt of MJS_SOURCE_EXTENSIONS) {
      const candidate = path.join(cwd, relative + srcExt);
      if (fs.existsSync(candidate)) {
        if (!isContained(candidate, cwd)) {
          return { ok: false };
        }
        return { ok: true, kind: "mjs", diskPath: candidate };
      }
    }

    return { ok: false };
  }

  if (ext === ".css") {
    const relative = urlPath.replace(/^\//, "");
    const candidate = path.join(cwd, relative);

    if (!fs.existsSync(candidate)) {
      return { ok: false };
    }

    if (!isContained(candidate, cwd)) {
      return { ok: false };
    }

    return { ok: true, kind: "css", diskPath: candidate };
  }

  // Unknown extension
  return { ok: false };
}

/**
 * Check that the resolved real path of candidate starts with the real path of cwd.
 * Uses fs.realpathSync to defeat symlink escape.
 * Returns false on any error (e.g., path does not exist).
 */
function isContained(candidate: string, cwd: string): boolean {
  try {
    const realCandidate = fs.realpathSync(candidate);
    const realCwd = fs.realpathSync(cwd);
    return realCandidate.startsWith(realCwd + path.sep);
  } catch {
    return false;
  }
}
