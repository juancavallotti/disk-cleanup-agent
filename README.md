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

## Commands

### CLI (direct)

When you pass a subcommand, the app runs that command and exits:

```bash
disk-cleanup --help              # Show main help
disk-cleanup cleanup --help      # Show cleanup subcommands
```

| Command | Description |
|--------|-------------|
| `disk-cleanup cleanup report` | Generate a cleanup report. The agent explores user directories (never system folders), suggests safe cleanup opportunities, and writes a YAML report to the app data dir (`~/.disk-cleanup/`). You approve a plan first, then the agent runs and streams progress. |
| `disk-cleanup cleanup script` | Generate a cleanup script from an existing report. You pick a report (if more than one), the agent produces a shell script (bash or PowerShell by platform), and it opens in your browser with syntax highlighting. |
| `disk-cleanup cleanup view` | View a saved report. Lists reports in the app data dir; if multiple, prompts you to pick one, then renders it as HTML and opens in your browser. |

No report yet? Run `cleanup report` first; then use `cleanup script` or `cleanup view` as needed.

### REPL (interactive)

Running the app **without** a `cleanup` subcommand starts an interactive REPL. You can then type:

| Command | Description |
|--------|-------------|
| `provider add` | Add a model provider (OpenAI or Anthropic). |
| `provider list` | List configured providers. |
| `provider select` | Interactively select which provider to use. |
| `provider delete [id]` | Remove a provider; interactive pick if no id given. |
| `cleanup report` | Same as CLI: generate a cleanup report. |
| `cleanup script` | Same as CLI: generate a cleanup script from a report. |
| `cleanup view` | Same as CLI: view a saved report. |
| `help` | Show available commands. |
| `quit`, `exit` | Exit the app. |

Example:

```bash
disk-cleanup
# REPL starts; then type e.g.:
#   provider list
#   cleanup report
#   exit
```

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

## Troubleshooting

On startup, the app prints the current process id and a ready-to-copy command:

```bash
Stack dump command: kill -SIGUSR2 <PID>
```

Run the printed command to force a stack dump from the running process.

In development mode (`npm run dev` / `npm run dev:watch`, where `ENV=dev`), pressing `Ctrl+C` also prints a stack dump before exiting.

Settings are stored in:

```bash
~/.disk-cleanup/state.json
```

To clear only the tool allow list prompts, edit `~/.disk-cleanup/state.json` and remove these keys:

- `toolAllowlist`
- `toolAllowedArgs`

To reset all app settings (providers, selected provider, allow list, and other saved state), delete the state file:

```bash
rm ~/.disk-cleanup/state.json
```

