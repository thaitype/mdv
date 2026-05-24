import * as path from "node:path";
import * as fs from "node:fs/promises";
import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { renderShell } from "./shell.js";
import { compileMdx } from "./compile-mdx.js";
import { compileAsset } from "./compile-asset.js";
import { resolveAsset } from "../resolve.js";

export interface AppConfig {
  entry: string;     // absolute path to the .vis.mdx entry file (resolved at boot)
  cwd: string;       // absolute real path of working directory (process.cwd() realpath)
  local: string;     // base URL for {{VISMD_LOCAL}}, e.g. "http://127.0.0.1:5173"
  registry: string;  // base URL for {{VISMD_REGISTRY}}
}

// Helper: normalize a compile/transform error message to a single line
function singleLine(msg: string): string {
  return msg.replace(/\n/g, " ");
}

export function createApp(config: AppConfig): Elysia<any, any, any, any, any, any> {
  const { entry, cwd, local, registry } = config;

  // Derive entryBasename by stripping the full .vis.mdx suffix
  const entryBasename = path.basename(entry).replace(/\.vis\.mdx$/, "");

  const app = new Elysia({ adapter: node() })

    // Route 1: GET / — serve HTML shell (exact match, registered first)
    .get("/", () => {
      return new Response(renderShell(entryBasename), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    })

    // Route 2: GET /_mdx/:name — compile MDX entry file
    // Strict: only matches when basename == entryBasename, otherwise 404
    .get("/_mdx/:name", async ({ params }) => {
      const rawName = params.name;
      // Strip .mjs suffix to get the bare basename
      const basename = rawName.endsWith(".mjs") ? rawName.slice(0, -4) : rawName;

      if (basename !== entryBasename) {
        return new Response(`Not found: /_mdx/${rawName}`, {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      const result = await compileMdx({ entryPath: entry, local, registry });

      if (result.kind === "ok") {
        return new Response(result.code, {
          status: 200,
          headers: {
            "Content-Type": "text/javascript; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      } else if (result.kind === "not-found") {
        return new Response(`Not found: /_mdx/${rawName}`, {
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

    // Route 3: GET /_* — reserved namespace, always 404
    // Must be registered before GET /* so it takes precedence
    .get("/_:rest*", ({ params }) => {
      const rest = (params as Record<string, string>)["rest"] ?? "";
      const url = `/_${rest}`;
      return new Response(`Not found: ${url}`, {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    })

    // Route 4: GET /* — unified asset dispatcher
    .get("/*", async ({ params, request }) => {
      const url = new URL(request.url);
      const fullUrlPath = url.pathname;

      const resolved = resolveAsset(fullUrlPath, cwd);

      if (!resolved.ok) {
        return new Response(`Not found: ${fullUrlPath}`, {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      if (resolved.kind === "css") {
        try {
          const content = await fs.readFile(resolved.diskPath, "utf-8");
          return new Response(content, {
            status: 200,
            headers: {
              "Content-Type": "text/css; charset=utf-8",
              "Cache-Control": "no-store",
            },
          });
        } catch {
          return new Response(`Not found: ${fullUrlPath}`, {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      }

      // kind === "mjs"
      const result = await compileAsset({ diskPath: resolved.diskPath });

      if (result.kind === "ok") {
        return new Response(result.code, {
          status: 200,
          headers: {
            "Content-Type": "text/javascript; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      } else {
        // transform-error
        return new Response(singleLine(result.message), {
          status: 500,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    });

  return app;
}
