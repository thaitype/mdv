#!/usr/bin/env node
/**
 * Smoke test for mdv milestone-1.
 * Spawns the CLI, waits for boot, runs HTTP checks, exits 0 on success.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = 5179;
const BASE = `http://127.0.0.1:${PORT}`;

// Spawn the CLI
const child = spawn(
  process.execPath,
  [
    "dist/cli.js",
    "examples/example.mdx",
    "--port", String(PORT),
    "--no-open",
    "--assets", "examples/components",
  ],
  { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"] }
);

let failed = false;

function fail(route, reason) {
  console.error(`[smoke] FAIL: ${route} — ${reason}`);
  failed = true;
}

async function shutdown() {
  child.kill("SIGINT");
  await new Promise((resolve) => {
    const t = setTimeout(() => { child.kill("SIGKILL"); resolve(); }, 2000);
    child.on("exit", () => { clearTimeout(t); resolve(); });
  });
}

// Wait for first stdout line (URL), polling up to 5s
async function waitForUrl() {
  return new Promise((resolve, reject) => {
    let buf = "";
    let done = false;
    const timeout = setTimeout(() => {
      if (!done) { done = true; reject(new Error("Timed out waiting for server URL")); }
    }, 5000);

    child.stdout.on("data", (chunk) => {
      if (done) return;
      buf += chunk.toString();
      const nl = buf.indexOf("\n");
      if (nl !== -1) {
        done = true;
        clearTimeout(timeout);
        resolve(buf.slice(0, nl).trimEnd());
      }
    });

    child.on("exit", (code) => {
      if (!done) {
        done = true;
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code} before printing URL`));
      }
    });
  });
}

async function check(label, url, expectedStatus, expectedCtPrefix, bodyAssertions) {
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    fail(label, `fetch error: ${e.message}`);
    return;
  }

  if (res.status !== expectedStatus) {
    fail(label, `expected status ${expectedStatus}, got ${res.status}`);
    return;
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.startsWith(expectedCtPrefix)) {
    fail(label, `expected content-type starting with "${expectedCtPrefix}", got "${ct}"`);
    return;
  }

  const body = await res.text();

  for (const assertion of bodyAssertions) {
    const result = assertion(body);
    if (result !== true) {
      fail(label, result);
      return;
    }
  }
}

function contains(sub) {
  return (body) => body.includes(sub) || `body does not contain: ${JSON.stringify(sub)}`;
}

function notContains(sub) {
  return (body) => !body.includes(sub) || `body must not contain: ${JSON.stringify(sub)}`;
}

function notMatchRe(re) {
  return (body) => !re.test(body) || `body must not match: ${re}`;
}

function equals(expected) {
  return (body) => body === expected || `expected body ${JSON.stringify(expected)}, got ${JSON.stringify(body)}`;
}

function nonEmpty() {
  return (body) => body.length > 0 || "body is empty";
}

async function run() {
  let url;
  try {
    url = await waitForUrl();
  } catch (e) {
    console.error(`[smoke] FAIL: boot — ${e.message}`);
    await shutdown();
    process.exit(1);
  }

  if (url !== BASE) {
    console.error(`[smoke] FAIL: boot — expected URL "${BASE}", got "${url}"`);
    await shutdown();
    process.exit(1);
  }

  await check(
    "GET /",
    `${BASE}/`,
    200,
    "text/html",
    [
      contains("/_mdx/example.mjs"),
      notMatchRe(/<link[^>]*stylesheet/i),
    ]
  );

  await check(
    "GET /_mdx/example.mjs",
    `${BASE}/_mdx/example.mjs`,
    200,
    "text/javascript",
    [
      notContains("{{MDV_LOCAL}}"),
      contains(`http://127.0.0.1:${PORT}/Hello`),
    ]
  );

  await check(
    "GET /Hello.mjs",
    `${BASE}/Hello.mjs`,
    200,
    "text/javascript",
    [nonEmpty()]
  );

  await check(
    "GET /styles.css",
    `${BASE}/styles.css`,
    200,
    "text/css",
    [contains("mdv-hello")]
  );

  await check(
    "GET /nope.mjs",
    `${BASE}/nope.mjs`,
    404,
    "text/plain",
    [equals("Not found: nope")]
  );

  await check(
    "GET /_mdx/bad-placeholder.mjs",
    `${BASE}/_mdx/bad-placeholder.mjs`,
    500,
    "text/plain",
    [equals("Unknown placeholder: {{MDV_FOO}}")]
  );

  await shutdown();

  if (failed) {
    process.exit(1);
  }

  console.log("[smoke] OK (6/6 checks)");
  process.exit(0);
}

run();
