/**
 * Browser open strategy: uses Node's child_process.exec with platform-specific
 * commands (open on darwin, start on win32, xdg-open on linux). No extra dep needed.
 *
 * Port 0 / local URL strategy:
 * When port 0 is requested we use net.createServer to find a free port, release it,
 * then bind the Elysia app on that specific port. This avoids two server start/stop
 * cycles and ensures `local` reflects the actual bound address before the app starts.
 * There is a tiny race window between releasing the probe socket and binding Elysia,
 * but this is acceptable in a dev-only tool.
 */
import * as net from "node:net";
import { exec } from "node:child_process";
import { createApp } from "../server/app.js";

export interface ServeOptions {
  entry: string;   // entry path as given on the CLI (may be relative)
  cwd: string;     // absolute real path of working directory
  port: number;    // 0 = pick any
  host: string;
  open: boolean;   // false when --no-open
}

function openBrowser(url: string): void {
  const platform = process.platform;
  let cmd: string;
  if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else if (platform === "win32") {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (err) => {
    if (err) {
      process.stderr.write(`vismd: warning: could not open browser: ${err.message}\n`);
    }
  });
}

/** Probe the OS for a free port, then release it. */
function findFreePort(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, host, () => {
      const addr = server.address() as net.AddressInfo;
      const port = addr.port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

export async function serve(opts: ServeOptions): Promise<void> {
  const { entry, cwd, host, open } = opts;

  const registry = process.env["VISMD_REGISTRY"] ?? "https://vismd.thaitype.dev";

  // Print stderr lines before binding (in order)
  process.stderr.write(`vismd: working directory: ${cwd}\n`);
  process.stderr.write(`vismd: serving ${entry}\n`);

  // Resolve actual port — if port: 0, probe for a free port first
  const actualPort = opts.port === 0 ? await findFreePort(host) : opts.port;
  const local = `http://${host}:${actualPort}`;

  // Create the app with the correct local URL (so {{VISMD_LOCAL}} substitution is correct)
  const app = createApp({ entry, cwd, local, registry });

  // Start the server; wait for the listen callback before printing the URL
  await new Promise<void>((resolve, reject) => {
    try {
      app.listen({ hostname: host, port: actualPort }, () => {
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });

  // Print the URL to stdout (machine-readable; one line)
  process.stdout.write(`${local}\n`);

  if (open) {
    openBrowser(local);
  }

  // Handle SIGINT cleanly
  process.on("SIGINT", async () => {
    await app.stop();
    process.exit(0);
  });
}
