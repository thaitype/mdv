import * as fs from "node:fs";
import * as path from "node:path";

const COMPONENT_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"] as const;

function isSafe(assetsDir: string, resolvedPath: string): boolean {
  const relative = path.relative(assetsDir, resolvedPath);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function resolveComponent(assetsDir: string, name: string): string | null {
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return null;
  }

  for (const ext of COMPONENT_EXTENSIONS) {
    const candidate = path.resolve(assetsDir, name + ext);
    if (!isSafe(assetsDir, candidate)) {
      return null;
    }
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function resolveCss(assetsDir: string, name: string): string | null {
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return null;
  }

  const candidate = path.resolve(assetsDir, name);
  if (!isSafe(assetsDir, candidate)) {
    return null;
  }

  return fs.existsSync(candidate) ? candidate : null;
}
