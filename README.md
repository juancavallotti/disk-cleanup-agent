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

## Usage

```bash
# Run the CLI
npm start

# Or link and run globally
npm link
disk-cleanup --help
```

## Structure

- **`src/index.js`** — Commander entry point; registers skills.
- **`src/skills/`** — One module per skill (command). Register each in `src/skills/index.js`.
- **`src/lib/openai.js`** — OpenAI SDK client (`getOpenAIClient()`).
- **`src/lib/langchain.js`** — LangChain + OpenAI chat model (`getChatModel()`).

Skills will be designed and added next; the base project is ready for that.
