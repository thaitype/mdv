#!/usr/bin/env node
/**
 * Smoke test for vismd milestone-2.
 * Spawns the CLI from cwd=examples/, waits for boot, runs HTTP checks, exits 0 on success.
 *
 * Assertions (10 total):
 *  1. Boot stderr contains working-directory line.
 *  2. GET / → 200, text/html, body contains /_mdx/example.mjs.
 *  3. GET /_mdx/example.mjs → 200, text/javascript, no {{VISMD_LOCAL}} in body.
 *  4. GET /components/Hello.mjs → 200, text/javascript.
 *  5. GET /styles/main.css → 200, text/css.
 *  6. GET /../etc/passwd → 404, text/plain, body matches /^Not found:/.
 *  7. Second server on bad-placeholder.vis.mdx: GET /_mdx/bad-placeholder.mjs → 500, body "Unknown placeholder: {{VISMD_FOO}}".
 *  8. Spawn with .mdx (not .vis.mdx) entry → non-zero exit + stderr contains "must end in .vis.mdx".
 *  9. Spawn with entry outside cwd → non-zero exit + stderr contains "outside working directory".
 * 10. All spawned servers shut down cleanly.
 */

import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const EXAMPLES_DIR = path.join(ROOT, "examples");
const CLI = path.join(ROOT, "dist", "cli.js");

// Ports for the two servers in this test
const PORT_MAIN = 5178;
const PORT_BAD  = 5179;
const BASE_MAIN = `http://127.0.0.1:${PORT_MAIN}`;
const BASE_BAD  = `http://127.0.0.1:${PORT_BAD}`;

let totalPass = 0;
let totalFail = 0;

function pass(label) {
  console.log(`[smoke] PASS: ${label}`);
  totalPass++;
}

function fail(label, reason) {
  console.error(`[smoke] FAIL: ${label} — ${reason}`);
  totalFail++;
}

// ── Assertion helpers ────────────────────────────────────────────────────────

function contains(sub) {
  return (body) => body.includes(sub) || `body does not contain: ${JSON.stringify(sub)}`;
}

function notContains(sub) {
  return (body) => !body.includes(sub) || `body must not contain: ${JSON.stringify(sub)}`;
}

function matchRe(re) {
  return (body) => re.test(body) || `body does not match: ${re}`;
}

function equals(expected) {
  return (body) => body === expected || `expected body ${JSON.stringify(expected)}, got ${JSON.stringify(body)}`;
}

function nonEmpty() {
  return (body) => body.length > 0 || "body is empty";
}

// ── Server lifecycle helpers ─────────────────────────────────────────────────

/**
 * Spawn vismd from cwd=examples/, accumulate stderr, and resolve with { url, stderr }
 * after the server prints its URL to stdout.
 */
function spawnServer(entry, port) {
  const child = spawn(
    process.execPath,
    ["../dist/cli.js", entry, "--port", String(port), "--no-open"],
    { cwd: EXAMPLES_DIR, stdio: ["ignore", "pipe", "pipe"] }
  );

  const stderrChunks = [];
  child.stderr.on("data", (chunk) => stderrChunks.push(chunk));

  const ready = new Promise((resolve, reject) => {
    let buf = "";
    let done = false;

    const timeout = setTimeout(() => {
      if (!done) {
        done = true;
        reject(new Error("Timed out waiting for server URL"));
      }
    }, 8000);

    child.stdout.on("data", (chunk) => {
      if (done) return;
      buf += chunk.toString();
      const nl = buf.indexOf("\n");
      if (nl !== -1) {
        done = true;
        clearTimeout(timeout);
        const url = buf.slice(0, nl).trimEnd();
        resolve({ url, child, stderrChunks });
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

  return ready;
}

async function shutdown(child) {
  child.kill("SIGINT");
  await new Promise((resolve) => {
    const t = setTimeout(() => { child.kill("SIGKILL"); resolve(); }, 3000);
    child.on("exit", () => { clearTimeout(t); resolve(); });
  });
}

// ── HTTP check helper ────────────────────────────────────────────────────────

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

  pass(label);
}

// ── Spawn-exit helper (for CLI validation tests) ─────────────────────────────

function spawnAndWait(args, cwdDir) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["../dist/cli.js", ...args], {
      cwd: cwdDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stderrChunks = [];
    child.stderr.on("data", (chunk) => stderrChunks.push(chunk));

    child.on("exit", (code) => {
      resolve({
        code,
        stderr: Buffer.concat(stderrChunks).toString(),
      });
    });
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  let mainChild;
  let badChild;
  let tempFile;

  try {
    // ── Boot main server ────────────────────────────────────────────────────
    let mainServer;
    try {
      mainServer = await spawnServer("example.vis.mdx", PORT_MAIN);
    } catch (e) {
      console.error(`[smoke] FAIL: boot — ${e.message}`);
      process.exit(1);
    }

    mainChild = mainServer.child;

    if (mainServer.url !== BASE_MAIN) {
      console.error(`[smoke] FAIL: boot — expected URL "${BASE_MAIN}", got "${mainServer.url}"`);
      await shutdown(mainChild);
      process.exit(1);
    }

    // ── Assertion 1: Boot stderr contains working-directory line ────────────
    // Give a moment for stderr to flush before checking
    await new Promise((r) => setTimeout(r, 50));
    const stderrSoFar = Buffer.concat(mainServer.stderrChunks).toString();
    const wdPattern = /^vismd: working directory: .*\/examples$/m;
    if (wdPattern.test(stderrSoFar)) {
      pass("1: boot stderr working-directory line");
    } else {
      fail("1: boot stderr working-directory line", `stderr did not match ${wdPattern}. Got: ${JSON.stringify(stderrSoFar)}`);
    }

    // ── Assertion 2: GET / ──────────────────────────────────────────────────
    await check(
      "2: GET /",
      `${BASE_MAIN}/`,
      200,
      "text/html",
      [contains("/_mdx/example.mjs")]
    );

    // ── Assertion 3: GET /_mdx/example.mjs — no leftover placeholder ────────
    await check(
      "3: GET /_mdx/example.mjs",
      `${BASE_MAIN}/_mdx/example.mjs`,
      200,
      "text/javascript",
      [notContains("{{VISMD_LOCAL}}")]
    );

    // ── Assertion 4: GET /components/Hello.mjs ──────────────────────────────
    await check(
      "4: GET /components/Hello.mjs",
      `${BASE_MAIN}/components/Hello.mjs`,
      200,
      "text/javascript",
      [nonEmpty()]
    );

    // ── Assertion 5: GET /styles/main.css ───────────────────────────────────
    await check(
      "5: GET /styles/main.css",
      `${BASE_MAIN}/styles/main.css`,
      200,
      "text/css",
      [nonEmpty()]
    );

    // ── Assertion 6: GET /../etc/passwd — path-traversal blocked ────────────
    // Use curl --path-as-is so curl does not normalize the ".." away client-side.
    {
      const label = "6: GET /../etc/passwd (path traversal blocked)";
      try {
        const curlResult = execSync(
          `curl -s -o /tmp/vismd-smoke-body.txt -w "%{http_code}\\n%{content_type}" --path-as-is "http://127.0.0.1:${PORT_MAIN}/../etc/passwd"`,
          { encoding: "utf-8" }
        );
        const lines = curlResult.split("\n");
        const statusCode = parseInt(lines[0], 10);
        const contentType = lines[1] ?? "";
        const body = fs.readFileSync("/tmp/vismd-smoke-body.txt", "utf-8");

        if (statusCode !== 404) {
          fail(label, `expected status 404, got ${statusCode}`);
        } else if (!contentType.startsWith("text/plain")) {
          fail(label, `expected content-type text/plain, got "${contentType}"`);
        } else if (!/^Not found:/.test(body)) {
          fail(label, `body does not match /^Not found:/. Got: ${JSON.stringify(body)}`);
        } else {
          pass(label);
        }
      } catch (e) {
        fail(label, `curl error: ${e.message}`);
      }
    }

    // ── Assertion 7: bad-placeholder server ─────────────────────────────────
    {
      const label = "7: GET /_mdx/bad-placeholder.mjs → 500 unknown placeholder";
      let badServer;
      try {
        badServer = await spawnServer("bad-placeholder.vis.mdx", PORT_BAD);
        badChild = badServer.child;
        // Brief settle: URL printed to stdout but socket may not be accepting yet
        await new Promise((r) => setTimeout(r, 100));

        await check(
          label,
          `${BASE_BAD}/_mdx/bad-placeholder.mjs`,
          500,
          "text/plain",
          [equals("Unknown placeholder: {{VISMD_FOO}}")]
        );
      } catch (e) {
        fail(label, `bad-placeholder server boot failed: ${e.message}`);
      } finally {
        if (badChild) {
          await shutdown(badChild);
          badChild = null;
        }
      }
    }

    // Shut down main server before CLI-only tests
    await shutdown(mainChild);
    mainChild = null;

    // ── Assertion 8: .mdx (not .vis.mdx) extension rejected ─────────────────
    {
      const label = "8: plain .mdx entry rejected with must end in .vis.mdx";
      const result = await spawnAndWait(["plain.mdx"], EXAMPLES_DIR);
      if (result.code === 0) {
        fail(label, "expected non-zero exit code, got 0");
      } else if (!result.stderr.includes("must end in .vis.mdx")) {
        fail(label, `stderr does not contain "must end in .vis.mdx". Got: ${JSON.stringify(result.stderr)}`);
      } else {
        pass(label);
      }
    }

    // ── Assertion 9: entry outside cwd rejected ──────────────────────────────
    {
      const label = "9: entry outside cwd rejected with outside working directory";
      // Create a temp .vis.mdx file outside examples/
      const tmpDir = os.tmpdir();
      tempFile = path.join(tmpDir, "outside-test.vis.mdx");
      fs.writeFileSync(tempFile, "# Outside\n");

      const result = await spawnAndWait([tempFile], EXAMPLES_DIR);
      if (result.code === 0) {
        fail(label, "expected non-zero exit code, got 0");
      } else if (!result.stderr.includes("outside working directory")) {
        fail(label, `stderr does not contain "outside working directory". Got: ${JSON.stringify(result.stderr)}`);
      } else {
        pass(label);
      }
    }

  } finally {
    // ── Assertion 10: Clean shutdown ─────────────────────────────────────────
    let shutdownOk = true;
    try {
      if (mainChild) {
        await shutdown(mainChild);
      }
      if (badChild) {
        await shutdown(badChild);
      }
    } catch (e) {
      shutdownOk = false;
      fail("10: all servers shut down cleanly", e.message);
    }
    if (shutdownOk) {
      pass("10: all servers shut down cleanly");
    }
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }

  const total = totalPass + totalFail;
  if (totalFail > 0) {
    console.error(`[smoke] FAIL (${totalPass}/${total} passed, ${totalFail} failed)`);
    process.exit(1);
  }

  console.log(`[smoke] OK (${totalPass}/${total} checks)`);
  process.exit(0);
}

run();
