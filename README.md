# vismd — MDX dev viewer

Serve a local `.mdx` file in the browser with live component resolution.

## Quick start

Run directly with `npx` (no install required):

```bash
# Serve an MDX file
npx @vismd/cli path/to/file.mdx

# With a custom components directory and port
npx @vismd/cli path/to/file.mdx --assets ./components --port 5173

# Don't auto-open the browser
npx @vismd/cli path/to/file.mdx --no-open
```

Or install globally and use the `vismd` command:

```bash
npm install -g @vismd/cli
vismd path/to/file.mdx
```

## Local development

```bash
pnpm install
pnpm run build

# Serve the example
node dist/cli.js examples/example.mdx --assets examples/components

# Run the automated smoke test
pnpm smoke
```

See [`examples/MANUAL_CHECK.md`](examples/MANUAL_CHECK.md) for a step-by-step browser verification guide.

---

# minimal-typescript-node-esm-starter

Welcome to the minimal TypeScript ESM (ECMAScript Modules) starter repository! This project provides a streamlined setup for building TypeScript projects with ECMAScript modules support.

## Feature
- Minimal setup with few config for TypeScript
- Run typescript without compile using [tsx](https://github.com/privatenumber/tsx)
- Zero-config test runner with [vitest](https://vitest.dev)
- [Test Coverage by v8](https://vitest.dev/guide/coverage.html)
- Bundling based on [tsup](https://github.com/egoist/tsup) which based on [esbuild](https://esbuild.github.io/)
- Lint `eslint` & Type-check
- Format with `Prettier`

## Getting Started
Clone this repository to kickstart your project:

```bash
git clone https://github.com/thaitype/minimal-typescript-node-esm-starter.git [project_name]
```

## Installation
Install dependencies using your preferred package manager:

```
pnpm install
```

You can also use `npm` or `yarn` if you prefer.

## Usage

Explore the provided scripts to enhance your development experience:

```bash
# Start the code
pnpm start

# Start the code with watch mode
pnpm dev

# Test the code with watch mode
pnpm test

# Test the code for CI (Run single time)
pnpm test:ci

# Test the code with coverage report
pnpm test:coverage

# Build the project
pnpm build

# Type check with TypeScript & eslint
pnpm lint

# Auto fix lint
pnpm lint:fix

# Format with Prettier
pnpm format
```

## Other runner option 
- If you still want to use [ava](https://github.com/avajs/ava), please check out branch [with-ava-test](https://github.com/thaitype/minimal-typescript-node-esm-starter/tree/with-ava-test)

## Additional TypeScript Compiler Options

Explore more TypeScript compiler options by referring to the [tsconfig cheatsheet](https://www.totaltypescript.com/tsconfig-cheat-sheet) created by Matt Pocock.

Feel free to customize and extend this starter kit based on your project requirements. Happy coding!