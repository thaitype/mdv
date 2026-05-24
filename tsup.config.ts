// Shebang approach: tsup `banner` option per build config.
// We export an array of two configs — one for cli.ts (with shebang banner)
// and one for index.ts (no banner, with dts). This is cleaner than a
// post-build script because tsup natively supports `banner` per entry config,
// so no shell scripting or extra file I/O is needed.

import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    outDir: "dist",
    banner: {
      js: "#!/usr/bin/env node",
    },
    clean: false,
  },
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    outDir: "dist",
    dts: true,
    clean: false,
  },
]);
