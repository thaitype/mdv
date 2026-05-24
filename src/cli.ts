import * as path from "node:path";
import { defineCommand, runMain } from "citty";
import { serve } from "./commands/serve.js";

const main = defineCommand({
  meta: {
    name: "mdv",
    version: "0.1.0",
    description: "Serve MDX files in the browser",
  },
  args: {
    entry: {
      type: "positional",
      required: true,
      description: "Path to .mdx file",
    },
    assets: {
      type: "string",
      default: "./components",
      description: "Components directory",
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
    const entry = path.resolve(args.entry);
    const assetsDir = path.resolve(args.assets);

    const portNum = Number(args.port);
    if (isNaN(portNum) || portNum < 0) {
      process.stderr.write(`error: invalid port: ${args.port}\n`);
      process.exit(1);
    }

    await serve({
      entry,
      assetsDir,
      port: portNum,
      host: args.host,
      open: !args["no-open"],
    });
  },
});

runMain(main);
