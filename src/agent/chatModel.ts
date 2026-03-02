/**
 * Chat model factory: build LangChain BaseChatModel from a Provider (config + optional model override).
 */

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import type { Provider, ProviderType } from "@/system/types.js";

const DEFAULT_MODEL: Record<ProviderType, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
};

const API_KEY_MESSAGE =
  "API key for this provider is not set. Set it in the app config (e.g. add the provider again with your API key, or edit the config file in your app config directory).";

export function createChatModelFromProvider(provider: Provider): BaseChatModel {
  const modelId = provider.model?.trim() || DEFAULT_MODEL[provider.type];
  const apiKey = provider.apiKey?.trim();
  if (!apiKey) {
    throw new Error(API_KEY_MESSAGE);
  }

  switch (provider.type) {
    case "openai":
      return new ChatOpenAI({
        model: modelId,
        temperature: 0.7,
        openAIApiKey: apiKey,
      });
    case "anthropic":
      return new ChatAnthropic({
        model: modelId,
        temperature: 0.7,
        anthropicApiKey: apiKey,
      });
    default:
      throw new Error(`Unsupported provider type: ${(provider as Provider).type}`);
  }
}
