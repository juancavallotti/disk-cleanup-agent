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
import { tools as anthropicTools } from "@langchain/anthropic";
import { tools as openAITools } from "@langchain/openai";
import type { BaseMessage } from "@langchain/core/messages";
import type { ReportAccumulator } from "./tools/reportCleanupOpportunity.js";
import {
  getSystemTypeTool,
  getCurrentUsernameTool,
  getCommonOffenderPathsTool,
  createCommandProbeTool,
  createListFoldersTool,
  createListFolderContentsBySizeTool,
  createChangeDirectoryTool,
  createGetFolderCapacityTool,
  createGetFolderCapacityBatchTool,
  createReportCleanupOpportunityTool,
  wrapToolWithAllowlist,
} from "./tools/index.js";

const WEB_SEARCH_DOMAINS = [
  "stackoverflow.com",
  "superuser.com",
  "serverfault.com",
  "askubuntu.com",
  "reddit.com",
  "substack.com",
  "medium.com",
  "github.com",
];

/** Domains Anthropic's web search crawler cannot access; excluded when provider is anthropic. */
const ANTHROPIC_BLOCKED_DOMAINS = new Set([
  "stackoverflow.com",
  "serverfault.com",
  "askubuntu.com",
  "reddit.com",
  "superuser.com",
]);

const SYSTEM_PROMPT = `You help the user free up space on their disk by producing a cleanup report.

RULES:
- Only consider user-writable locations: home directory, caches in home, user data. NEVER use or suggest system folders (e.g. /System, /Library, /usr on macOS; C:\\Windows on Windows; /etc, /usr on Linux). Your tools will reject system paths.
- Only suggest removing a user folder if it is a well-known junk-accumulator (e.g. Cache, Caches, Temp, tmp, Trash, .Trash, browser caches, npm/yarn caches, package-manager caches, IDE caches, old download installers). Do NOT suggest deleting arbitrary user folders such as Documents, Desktop, project directories, or application data unless they are clearly cache/temp/trash. When in doubt, do not report the folder.
- For each cleanup opportunity you find, you MUST call report_cleanup_opportunity with an array "opportunities" where each item has: path, pathDescription, sizeBytes, contentsDescription, whySafeToDelete, and optional suggestedAction. You may report one or many opportunities per call; prefer batching multiple findings into a single call when you have several. Provide a clear contents description and safety justification for each.
- When a command-related cache (e.g. npm, docker, brew, yarn) is using a lot of space and that command is installed, suggest using that command's own cleanup (e.g. \`npm cache clean --force\`, \`docker system prune\`, \`brew cleanup\`) in suggestedAction rather than only recommending deleting the directory. Prefer "run this command to clean" over "delete these files" when the cache is tied to an installed tool.

WORKFLOW — Plan-building phase (do these steps first, in order):
(a) Look at the OS: Call get_system_type and get_current_username so the plan is OS-aware.
(b) Look for common offenders: Call get_common_offender_paths to get candidate directories for the current OS (quick-win locations).
(c) Probe for commands: Call command_probe with relevant command names (e.g. npm, yarn, docker, brew) to see which are installed and can inform which caches to prioritize.
(d) Build the plan: Output your GAME PLAN (which directories to inspect, in what order, what you will measure). Then execute using your tools.

Quick wins vs. filesystem exploration: Common offenders are quick wins—prioritize checking them first. You MUST still explore the filesystem: use list_folders from home, list_folder_contents_by_size on large dirs, drill into subfolders. Do not rely only on the common-offender list; it is a starting point, not a way to skip filesystem inspection.

Execution: Use get_system_type, get_current_username, get_common_offender_paths, command_probe, list_folders, list_folder_contents_by_size, change_directory, get_folder_capacity, get_folder_capacity_batch. Use list_folder_contents_by_size when you need to see which files or subfolders inside a directory are large (returns a markdown table). Use get_folder_capacity_batch to measure multiple paths in parallel. For each location that is safe to clean, call report_cleanup_opportunity with opportunities: [{ path, pathDescription, sizeBytes, contentsDescription, whySafeToDelete, suggestedAction? }, ...]. When done, summarize and stop.

If you have the web_search tool: You may use it to look up the best way to clean or safely remove suspicious or non-obvious items. Prefer suggesting actions like "Clear via app settings", "Run \`xyz\` to prune", or "Safe to delete after backup" when search results support them, and put that in suggestedAction.`;

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

const ALLOWLIST_TOOL_NAMES = [
  "list_folders",
  "list_folder_contents_by_size",
  "change_directory",
  "get_folder_capacity",
  "get_folder_capacity_batch",
  "get_common_offender_paths",
  "command_probe",
];

type WebSearchTool =
  | ReturnType<typeof openAITools.webSearch>
  | ReturnType<typeof anthropicTools.webSearch_20250305>;

/** Build extra tools (web_search when OpenAI/Anthropic, report_cleanup_opportunity when accumulator). Used in getGraph and in tests. */
export function getExtraToolsForReport(
  provider: Provider,
  reportAccumulator?: ReportAccumulator
): (ReturnType<typeof createReportCleanupOpportunityTool> | WebSearchTool)[] {
  const extra: (ReturnType<typeof createReportCleanupOpportunityTool> | WebSearchTool)[] = [];
  if (provider.type === "openai") {
    extra.push(openAITools.webSearch({ filters: { allowedDomains: WEB_SEARCH_DOMAINS } }));
  }
  if (provider.type === "anthropic") {
    const anthropicDomains = WEB_SEARCH_DOMAINS.filter((d) => !ANTHROPIC_BLOCKED_DOMAINS.has(d));
    extra.push(anthropicTools.webSearch_20250305({ allowedDomains: anthropicDomains }));
  }
  if (reportAccumulator) {
    extra.push(createReportCleanupOpportunityTool(reportAccumulator));
  }
  return extra;
}

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
      const provider = this.getProvider();
      const defaultCwd = process.cwd();
      const onProgress = options?.thinkingStreamWriter;

      const baseTools = [
        getSystemTypeTool,
        getCurrentUsernameTool,
        wrapToolWithAllowlist(getCommonOffenderPathsTool, allowlistMiddleware),
        wrapToolWithAllowlist(createCommandProbeTool(), allowlistMiddleware),
        wrapToolWithAllowlist(createListFoldersTool({ defaultCwd, onProgress }), allowlistMiddleware),
        wrapToolWithAllowlist(createListFolderContentsBySizeTool({ defaultCwd, onProgress }), allowlistMiddleware),
        wrapToolWithAllowlist(createChangeDirectoryTool({ defaultCwd }), allowlistMiddleware),
        wrapToolWithAllowlist(createGetFolderCapacityTool({ defaultCwd, onProgress }), allowlistMiddleware),
        wrapToolWithAllowlist(createGetFolderCapacityBatchTool({ defaultCwd, onProgress }), allowlistMiddleware),
      ];

      const extraTools = getExtraToolsForReport(provider, reportAccumulator);
      const tools = [...baseTools, ...extraTools];

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
