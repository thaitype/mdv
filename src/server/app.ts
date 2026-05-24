import * as fs from "node:fs/promises";
import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { renderShell } from "./shell.js";
import { compileMdx } from "./compile-mdx.js";
import { compileAsset } from "./compile-asset.js";
import { resolveCss } from "../resolve.js";

export interface AppConfig {
  entryDir: string;   // directory containing the .mdx entry file
  entryName: string;  // basename without ".mdx"
  assetsDir: string;  // absolute path to --assets dir
  local: string;      // base URL for {{MDV_LOCAL}}, e.g. "http://127.0.0.1:5173"
  registry: string;   // base URL for {{MDV_REGISTRY}}
}

// Helper: normalize a compile/transform error message to a single line
function singleLine(msg: string): string {
  return msg.replace(/\n/g, " ");
}

export function createApp(config: AppConfig): Elysia<any, any, any, any, any, any> {
  const { entryDir, entryName, assetsDir, local, registry } = config;

  const app = new Elysia({ adapter: node() })

    // Route 1: GET / — serve HTML shell (exact match, registered first)
    .get("/", () => {
      return new Response(renderShell(entryName), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    })

    // Route 2: GET /_mdx/:name — compile MDX file
    // The URL pattern is /_mdx/<name>.mjs; the :name param captures the full segment
    .get("/_mdx/:name", async ({ params }) => {
      const rawName = params.name;
      // Strip .mjs suffix to get the bare mdx basename
      const name = rawName.endsWith(".mjs") ? rawName.slice(0, -4) : rawName;

      const result = await compileMdx({ entryDir, entryName: name, local, registry });

      if (result.kind === "ok") {
        return new Response(result.code, {
          status: 200,
          headers: {
            "Content-Type": "text/javascript; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      } else if (result.kind === "not-found") {
        return new Response(`Not found: ${name}.mdx`, {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      } else if (result.kind === "unknown-placeholder") {
        return new Response(`Unknown placeholder: ${result.placeholder}`, {
          status: 500,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      } else {
        // compile-error
        return new Response(singleLine(result.message), {
          status: 500,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })

    // Routes 3 & 4: handle /:path where path ends with .css or .mjs
    // Both use the same top-level param slot, so we use a single wildcard route
    // and dispatch inside based on the suffix.
    //
    // Route precedence inside this handler:
    //   1. Block any path starting with _ (reserved for internal routes like /_mdx)
    //   2. .css → serve static CSS from assetsDir
    //   3. .mjs → compile asset from assetsDir
    //   4. anything else → 404
    .get("/*", async ({ params }) => {
      // Elysia wildcard puts the matched portion in params["*"]
      const path = (params as Record<string, string>)["*"] ?? "";

      // Block any reserved internal path (starts with _)
      if (path.startsWith("_")) {
        return new Response(`Not found: ${path}`, {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      // Route 3: .css — serve static CSS
      if (path.endsWith(".css")) {
        const cssPath = resolveCss(assetsDir, path);
        if (cssPath === null) {
          return new Response(`Not found: ${path}`, {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        try {
          const content = await fs.readFile(cssPath, "utf-8");
          return new Response(content, {
            status: 200,
            headers: { "Content-Type": "text/css; charset=utf-8" },
          });
        } catch {
          return new Response(`Not found: ${path}`, {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      }

      // Route 4: .mjs — compile asset
      if (path.endsWith(".mjs")) {
        const componentName = path.slice(0, -4); // strip .mjs

        const result = await compileAsset({ assetsDir, componentName });

        if (result.kind === "ok") {
          return new Response(result.code, {
            status: 200,
            headers: {
              "Content-Type": "text/javascript; charset=utf-8",
              "Cache-Control": "no-store",
            },
          });
        } else if (result.kind === "not-found") {
          return new Response(`Not found: ${componentName}`, {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        } else {
          // transform-error
          return new Response(singleLine(result.message), {
            status: 500,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      }

      // Route 4b: bare path (no extension) — try component resolution.
      // Author-facing imports look like `import X from "{{MDV_LOCAL}}/X"`
      // (no .mjs), so the server must accept the bare form too.
      {
        const result = await compileAsset({ assetsDir, componentName: path });
        if (result.kind === "ok") {
          return new Response(result.code, {
            status: 200,
            headers: {
              "Content-Type": "text/javascript; charset=utf-8",
              "Cache-Control": "no-store",
            },
          });
        }
        if (result.kind === "transform-error") {
          return new Response(singleLine(result.message), {
            status: 500,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        // not-found → fall through to 404
      }

      // No matching route
      return new Response(`Not found: ${path}`, {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    });

  return app;
}
