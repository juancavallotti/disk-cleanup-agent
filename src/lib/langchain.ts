/**
 * LangChain + OpenAI — use for chains, agents, RAG, etc.
 * Set OPENAI_API_KEY or OPENAI_TOKEN in .env or environment.
 * LangSmith: LANGCHAIN_TRACING_V2=true, LANGCHAIN_API_KEY, LANGCHAIN_PROJECT.
 */

function getOpenAIKey(): string | undefined {
  return process.env.OPENAI_API_KEY ?? process.env.OPENAI_TOKEN;
}

export async function getChatModel(options: Record<string, unknown> = {}) {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY or OPENAI_TOKEN is not set. Add one to .env or your environment.");
  }
  const { ChatOpenAI } = await import("@langchain/openai");
  return new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.7,
    openAIApiKey: apiKey,
    ...options,
  });
}
