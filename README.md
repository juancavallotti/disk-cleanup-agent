# disk-cleanup

CLI app built with **Commander**, **LangChain**, and **OpenAI**. Designed around pluggable *skills* (commands).

**Repo:** [github.com/juancavallotti/disk-cleanup-agent](https://github.com/juancavallotti/disk-cleanup-agent)

## Setup

```bash
npm install
```

Copy the example env and add your keys:

```bash
cp .env.example .env
```

Then edit `.env` and set:

- **OpenAI:** `OPENAI_API_KEY` or `OPENAI_TOKEN` (e.g. `sk-...`)
- **LangSmith:** `LANGCHAIN_API_KEY` (from [smith.langchain.com](https://smith.langchain.com)); optional `LANGCHAIN_PROJECT` (default: `disk-cleanup-agent`). Set `LANGCHAIN_TRACING_V2=true` to enable traces.

## Build

Build compiles TypeScript to `dist/`, resolves path aliases, and copies agent skills:

```bash
npm run build
```

This runs:

1. **`tsc`** — Compiles `src/` to `dist/` (ES2022, NodeNext modules).
2. **`tsc-alias`** — Replaces `@/` path aliases with relative paths in `dist/`.
3. **`scripts/copy-skills.mjs`** — Copies skill files (e.g. `.md`) into `dist/` so the built app can load them at runtime.

After a successful build, the runnable entry point is `dist/index.js`.

## Run

**From source (development, no build):**

```bash
npm run dev
```

Runs the app with `tsx` and supports loading `.md` skills via `scripts/register-md.mjs`. Use `npm run dev:watch` for watch mode.

**From built output:**

```bash
npm start
```

Runs `node dist/index.js` with the same md loader. Use this after `npm run build`.

**Global install (CLI on your PATH):**

```bash
npm run build
npm link
disk-cleanup --help
```

Then run `disk-cleanup` from any directory.

## Release

1. **Bump version** in `package.json` (e.g. `0.1.0` → `0.2.0`), or use:

   ```bash
   npm version patch   # 0.1.0 → 0.1.1
   npm version minor   # 0.1.0 → 0.2.0
   npm version major   # 0.1.0 → 1.0.0
   ```

2. **Build and test:**

   ```bash
   npm run build
   npm run test:run
   ```

3. **Publish to npm** (requires npm login and publish access):

   ```bash
   npm publish
   ```

   To do a dry run without publishing:

   ```bash
   npm publish --dry-run
   ```

   For a scoped package (e.g. `@yourname/disk-cleanup`), use:

   ```bash
   npm publish --access public
   ```

After publishing, users can install globally with:

```bash
npm install -g disk-cleanup
```

## Development

Run the app from source (no build step):

```bash
npm run dev
```

Run tests in watch mode:

```bash
npm test
```

Run tests once (e.g. for CI):

```bash
npm run test:run
```

## Structure

- **`src/index.ts`** — Entry point; bootstraps system and runs the CLI/REPL.
- **`src/system/`** — Configuration, state, and bootstrap; wires agent and tools to services.
- **`src/cli/`** — Commander commands; one command per file.
- **`src/services/`** — Domain/business logic; used by system and tools.
- **`src/agent/`** — Agent and `src/agent/tools/`; tools are wired by the system layer.
