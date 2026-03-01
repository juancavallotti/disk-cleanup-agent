/**
 * Agent: in-memory checkpointer, resolve selected provider, chat model, system prompt, tools (wrapped by allowlist + human-in-the-loop).
 */

import type { BaseMessage } from "@langchain/core/messages";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import type { StateService } from "@/system/stateService.js";
import type { ProviderService } from "@/services/providerService.js";
import type { AllowlistMiddleware } from "./allowlistMiddleware.js";
import { createChatModelFromProvider } from "./chatModel.js";
import { SELECTED_PROVIDER_ID_KEY } from "@/system/types.js";
import type { Provider } from "@/system/types.js";

const SYSTEM_PROMPT = `You help the user free up space on their disk. You can either:
1. Produce a report with an action plan to clean it up, or
2. Take a report in and execute on it.

Be clear and actionable.`;

/** In-memory checkpointer: thread_id -> messages. */
const checkpointStore = new Map<string, BaseMessage[]>();

function getOrCreateThread(threadId: string): BaseMessage[] {
  let messages = checkpointStore.get(threadId);
  if (!messages) {
    messages = [];
    checkpointStore.set(threadId, messages);
  }
  return messages;
}

export interface DiskCleanupAgentOptions {
  stateService: StateService;
  providerService: ProviderService;
  allowlistMiddleware: AllowlistMiddleware;
}

export interface DiskCleanupAgent {
  /** Resolve the current provider (selected or first). */
  getProvider(): Provider;
  /** Get the chat model for the current provider (rebuilds from state). */
  getChatModel(): ReturnType<typeof createChatModelFromProvider>;
  /** Invoke the agent: append user message, run model with system prompt + checkpointed messages, checkpoint response, return content. */
  invoke(threadId: string, userContent: string): Promise<string>;
}

function resolveProvider(stateService: StateService, providerService: ProviderService): Provider {
  const state = stateService.getState();
  const selectedId = state[SELECTED_PROVIDER_ID_KEY] as string | undefined;
  const providers = providerService.listProviders();
  if (providers.length === 0) throw new Error("No providers configured.");
  if (selectedId) {
    const found = providers.find((p) => p.id === selectedId);
    if (found) return found;
  }
  return providers[0];
}

export function createAgent(options: DiskCleanupAgentOptions): DiskCleanupAgent {
  const { stateService, providerService, allowlistMiddleware } = options;

  return {
    getProvider(): Provider {
      return resolveProvider(stateService, providerService);
    },

    getChatModel() {
      const provider = resolveProvider(stateService, providerService);
      return createChatModelFromProvider(provider);
    },

    async invoke(threadId: string, userContent: string): Promise<string> {
      const messages = getOrCreateThread(threadId);
      messages.push(new HumanMessage(userContent));

      const systemMessage = new SystemMessage(SYSTEM_PROMPT);
      const model = this.getChatModel();
      const allMessages: BaseMessage[] = [systemMessage, ...messages];
      const response = await model.invoke(allMessages) as AIMessage;
      messages.push(response);

      const content = typeof response.content === "string" ? response.content : "";
      return content;
    },
  };
}
