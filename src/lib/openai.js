/**
 * OpenAI client — use for direct OpenAI API calls.
 * Set OPENAI_API_KEY or OPENAI_TOKEN in .env or environment.
 */

function getOpenAIKey() {
  return process.env.OPENAI_API_KEY || process.env.OPENAI_TOKEN;
}

export async function getOpenAIClient() {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY or OPENAI_TOKEN is not set. Add one to .env or your environment.");
  }
  const { default: OpenAI } = await import("openai");
  return new OpenAI({ apiKey });
}
