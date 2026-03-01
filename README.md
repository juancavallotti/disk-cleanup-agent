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

Compile TypeScript to `dist/`:

```bash
npm run build
```

Run the built app:

```bash
npm start
```

Or install the CLI globally and run it:

```bash
npm run build
npm link
disk-cleanup --help
```

## Development

Run the app from source with watch (no build step):

```bash
npm run dev
```

Run tests (watch mode):

```bash
npm test
```

Run tests once (e.g. for CI):

```bash
npm run test:run
```

## Structure

- **`src/index.ts`** — Commander entry point; registers skills.
- **`src/skills/`** — One module per skill (command). Register each in `src/skills/index.ts`.
- **`src/lib/openai.ts`** — OpenAI SDK client (`getOpenAIClient()`).
- **`src/lib/langchain.ts`** — LangChain + OpenAI chat model (`getChatModel()`).

Skills will be designed and added next; the base project is ready for that.
