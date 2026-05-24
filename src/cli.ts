import * as path from "node:path";
import * as fs from "node:fs/promises";
import { defineCommand, runMain } from "citty";
import { serve } from "./commands/serve.js";

const main = defineCommand({
  meta: {
    name: "vismd",
    version: "0.1.0",
    description: "Serve MDX files in the browser",
  },
  args: {
    entry: {
      type: "positional",
      required: true,
      description: "Path to .vis.mdx file",
    },
    port: {
      type: "string",
      default: "0",
      description: "Bind port (0 = auto)",
    },
    host: {
      type: "string",
      default: "127.0.0.1",
      description: "Bind host",
    },
    "no-open": {
      type: "boolean",
      default: false,
      description: "Don't auto-open browser",
    },
  },
  async run({ args }) {
    const entryArg = args.entry;

    // Step 1: Extension check — must end exactly with .vis.mdx
    if (!entryArg.endsWith(".vis.mdx")) {
      const basename = path.basename(entryArg);
      // Strip trailing .mdx if present to suggest the rename
      const withoutMdx = basename.endsWith(".mdx") ? basename.slice(0, -4) : basename;
      process.stderr.write(
        `vismd: error: file must end in .vis.mdx (got: ${basename}). Rename to ${withoutMdx}.vis.mdx.\n`
      );
      process.exit(1);
    }

    // Step 2: Existence / readability check
    try {
      await fs.access(entryArg);
    } catch {
      process.stderr.write(`vismd: error: cannot read ${entryArg}\n`);
      process.exit(1);
    }

    // Step 3: Containment check
    const entryReal = await fs.realpath(entryArg);
    const cwdReal = await fs.realpath(process.cwd());
    if (!entryReal.startsWith(cwdReal + path.sep)) {
      process.stderr.write(
        `vismd: error: entry file ${entryReal} is outside working directory ${cwdReal}\n`
      );
      process.exit(1);
    }

    const portNum = Number(args.port);
    if (isNaN(portNum) || portNum < 0) {
      process.stderr.write(`error: invalid port: ${args.port}\n`);
      process.exit(1);
    }

    await serve({
      entry: entryArg,
      cwd: cwdReal,
      port: portNum,
      host: args.host,
      open: !args["no-open"],
    });
  },
});

runMain(main);
