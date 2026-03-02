/**
 * Agent: ReAct agent via langchain createAgent, with allowlist middleware and optional report accumulator.
 */

import { HumanMessage } from "@langchain/core/messages";
import type { StateService } from "@/system/stateService.js";
import type { ProviderService } from "@/services/providerService.js";
import type { AllowlistMiddleware } from "./allowlistMiddleware.js";
import { createChatModelFromProvider } from "./chatModel.js";
import { SELECTED_PROVIDER_ID_KEY } from "@/system/types.js";
import type { Provider } from "@/system/types.js";
import { createAgent as createLangchainAgent } from "langchain";
import type { BaseMessage } from "@langchain/core/messages";
import type { ReportAccumulator } from "./tools/reportCleanupOpportunity.js";
import {
  getSystemTypeTool,
  getCurrentUsernameTool,
  createListFoldersTool,
  createListFolderContentsBySizeTool,
  createChangeDirectoryTool,
  createGetFolderCapacityTool,
  createGetFolderCapacityBatchTool,
  createReportCleanupOpportunityTool,
  wrapToolWithAllowlist,
} from "./tools/index.js";

const SYSTEM_PROMPT = `You help the user free up space on their disk by producing a cleanup report.

RULES:
- Only consider user-writable locations: home directory, caches in home, user data. NEVER use or suggest system folders (e.g. /System, /Library, /usr on macOS; C:\\Windows on Windows; /etc, /usr on Linux). Your tools will reject system paths.
- For each cleanup opportunity you find, you MUST call report_cleanup_opportunity with: path, pathDescription, sizeBytes, contentsDescription (what is in there), whySafeToDelete (why it is safe or okay to delete), and optional suggestedAction. Provide a clear contents description and safety justification.

WORKFLOW:
1. First output a GAME PLAN: which directories you will inspect (only user locations), in what order, and what you will measure. The user will see this streamed.
2. Then execute that plan using your tools: get_system_type, get_current_username, list_folders, list_folder_contents_by_size, change_directory, get_folder_capacity, get_folder_capacity_batch. Use list_folder_contents_by_size when you need to see which specific files or subfolders inside a directory are large (returns a markdown table of path, fileSize, kind sorted by size) so you can report individual items via report_cleanup_opportunity. Use get_folder_capacity_batch when you need to measure multiple paths to run them in parallel and save time.
3. For each location that is safe to clean, call report_cleanup_opportunity. When you have finished exploring and reporting, summarize and stop.`;

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

const ALLOWLIST_TOOL_NAMES = ["list_folders", "list_folder_contents_by_size", "change_directory", "get_folder_capacity", "get_folder_capacity_batch"];

export interface DiskCleanupAgentOptions {
  stateService: StateService;
  providerService: ProviderService;
  allowlistMiddleware: AllowlistMiddleware;
}

/** Options passed when building the graph for a streamed run (e.g. to allow tools to stream progress to the thinking display). */
export interface GetGraphOptions {
  /** When set, long-running tools may call this to stream progress to the thinking stream. */
  thinkingStreamWriter?: (text: string) => void;
}

export interface DiskCleanupAgent {
  getProvider(): Provider;
  getChatModel(): ReturnType<typeof createChatModelFromProvider>;
  /** Build the ReAct graph for report run. If reportAccumulator is provided, includes report_cleanup_opportunity tool. */
  getGraph(reportAccumulator?: ReportAccumulator, options?: GetGraphOptions): ReturnType<typeof createLangchainAgent>;
  /** Legacy: run one turn (no tools). Prefer getGraph().stream() for report flow. */
  invoke(threadId: string, userContent: string): Promise<string>;
}

export function createAgent(options: DiskCleanupAgentOptions): DiskCleanupAgent {
  const { stateService, providerService, allowlistMiddleware } = options;

  for (const name of ALLOWLIST_TOOL_NAMES) {
    allowlistMiddleware.registerAllowedTool(name);
  }

  return {
    getProvider(): Provider {
      return resolveProvider(stateService, providerService);
    },

    getChatModel() {
      const provider = resolveProvider(stateService, providerService);
      return createChatModelFromProvider(provider);
    },

    getGraph(reportAccumulator?: ReportAccumulator, options?: GetGraphOptions) {
      const model = this.getChatModel();
      const defaultCwd = process.cwd();
      const onProgress = options?.thinkingStreamWriter;

      const baseTools = [
        getSystemTypeTool,
        getCurrentUsernameTool,
        wrapToolWithAllowlist(createListFoldersTool({ defaultCwd, onProgress }), allowlistMiddleware),
        wrapToolWithAllowlist(createListFolderContentsBySizeTool({ defaultCwd, onProgress }), allowlistMiddleware),
        wrapToolWithAllowlist(createChangeDirectoryTool({ defaultCwd }), allowlistMiddleware),
        wrapToolWithAllowlist(createGetFolderCapacityTool({ defaultCwd, onProgress }), allowlistMiddleware),
        wrapToolWithAllowlist(createGetFolderCapacityBatchTool({ defaultCwd, onProgress }), allowlistMiddleware),
      ];

      const tools = reportAccumulator
        ? [...baseTools, createReportCleanupOpportunityTool(reportAccumulator)]
        : baseTools;

      const agent = createLangchainAgent({
        model,
        tools,
        systemPrompt: SYSTEM_PROMPT,
      });

      return agent;
    },

    async invoke(threadId: string, userContent: string): Promise<string> {
      const graph = this.getGraph();
      const result = await graph.invoke(
        { messages: [new HumanMessage(userContent)] },
        { configurable: { thread_id: threadId } }
      );
      const messages = (result as { messages?: BaseMessage[] })?.messages ?? [];
      const last = messages[messages.length - 1];
      const content = last && typeof (last as { content?: string }).content === "string" ? (last as { content: string }).content : "";
      return content;
    },
  };
}
