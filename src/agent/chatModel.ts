/**
 * Chat model factory: build LangChain BaseChatModel from a Provider (config + optional model override).
 */

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import type { Provider, ProviderType } from "@/system/types.js";

export const DEFAULT_MODEL: Record<ProviderType, string> = {
  openai: "gpt-5-mini",
  anthropic: "claude-haiku-4-5",
};

/** Resolve the model id used for a provider (override or default). */
export function getModelId(provider: Provider): string {
  return provider.model?.trim() || DEFAULT_MODEL[provider.type];
}

const API_KEY_MESSAGE =
  "API key for this provider is not set. Set it in the app config or in .env (OPENAI_API_KEY / OPENAI_TOKEN for OpenAI, ANTHROPIC_API_KEY for Anthropic).";

function resolveOpenAIKey(provider: Provider): string {
  const fromProvider = provider.apiKey?.trim();
  if (fromProvider) return fromProvider;
  const fromEnv = process.env.OPENAI_API_KEY?.trim() ?? process.env.OPENAI_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  throw new Error(API_KEY_MESSAGE);
}

function resolveAnthropicKey(provider: Provider): string {
  const fromProvider = provider.apiKey?.trim();
  if (fromProvider) return fromProvider;
  const fromEnv = process.env.ANTHROPIC_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  throw new Error(API_KEY_MESSAGE);
}

export function createChatModelFromProvider(provider: Provider): BaseChatModel {
  const modelId = getModelId(provider);

  switch (provider.type) {
    case "openai": {
      const apiKey = resolveOpenAIKey(provider);
      const isGpt5 = /^gpt-5/i.test(modelId);
      return new ChatOpenAI({
        model: modelId,
        ...(isGpt5 ? {} : { temperature: 0.7 }),
        apiKey,
      });
    }
    case "anthropic": {
      const apiKey = resolveAnthropicKey(provider);
      return new ChatAnthropic({
        model: modelId,
        temperature: 0.7,
        anthropicApiKey: apiKey,
      });
    }
    default:
      throw new Error(`Unsupported provider type: ${(provider as Provider).type}`);
  }
}
