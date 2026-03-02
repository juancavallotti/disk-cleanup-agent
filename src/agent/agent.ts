/**
 * Agent: ReAct agent via langchain createAgent, with allowlist middleware and optional report accumulator.
 */

import { HumanMessage } from "@langchain/core/messages";
import type { StateService } from "@/system/stateService.js";
import type { ProviderService } from "@/services/providerService.js";
import { ALLOWLIST_TOOL_NAMES, type AllowlistMiddleware } from "./allowlistMiddleware.js";
import { createChatModelFromProvider } from "./chatModel.js";
import { SELECTED_PROVIDER_ID_KEY } from "@/system/types.js";
import type { Provider } from "@/system/types.js";
import { createAgent as createLangchainAgent } from "langchain";
import { tools as anthropicTools } from "@langchain/anthropic";
import { tools as openAITools } from "@langchain/openai";
import type { BaseMessage } from "@langchain/core/messages";
import type { ReportAccumulator } from "./tools/reportCleanupOpportunity.js";
import type { ScriptAccumulator } from "./tools/submitCleanupScript.js";
import {
  getSystemTypeTool,
  getCurrentUsernameTool,
  getSkillTool,
  createCommandProbeTool,
  createListFoldersTool,
  createListFoldersBatchTool,
  createListFolderContentsBySizeTool,
  createChangeDirectoryTool,
  createGetFolderCapacityTool,
  createGetFolderCapacityBatchTool,
  createReportCleanupOpportunityTool,
  createSubmitCleanupScriptTool,
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

const SYSTEM_PROMPT = `You help the user free up disk space. For each task, call the get_skill tool with the appropriate skill name (the user or the current request will indicate which: "report" or "script") to load task-specific instructions. After loading the skill, follow those instructions and use the tools they describe.`;


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

type WebSearchTool =
  | ReturnType<typeof openAITools.webSearch>
  | ReturnType<typeof anthropicTools.webSearch_20250305>;

type ExtraTool =
  | ReturnType<typeof createReportCleanupOpportunityTool>
  | ReturnType<typeof createSubmitCleanupScriptTool>
  | WebSearchTool;

/** Build extra tools (web_search when OpenAI/Anthropic, report_cleanup_opportunity when report accumulator, submit_cleanup_script when script accumulator). */
export function getExtraToolsForReport(
  provider: Provider,
  reportAccumulator?: ReportAccumulator,
  scriptAccumulator?: ScriptAccumulator
): ExtraTool[] {
  const extra: ExtraTool[] = [];
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
  if (scriptAccumulator) {
    extra.push(createSubmitCleanupScriptTool(scriptAccumulator));
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
  /** Build the ReAct graph. Pass reportAccumulator for report flow, scriptAccumulator for script flow. */
  getGraph(
    reportAccumulator?: ReportAccumulator,
    scriptAccumulator?: ScriptAccumulator,
    options?: GetGraphOptions
  ): ReturnType<typeof createLangchainAgent>;
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

    getGraph(
      reportAccumulator?: ReportAccumulator,
      scriptAccumulator?: ScriptAccumulator,
      options?: GetGraphOptions
    ) {
      const model = this.getChatModel();
      const provider = this.getProvider();
      const defaultCwd = process.cwd();
      const onProgress = options?.thinkingStreamWriter;

      const baseTools = [
        getSystemTypeTool,
        getCurrentUsernameTool,
        wrapToolWithAllowlist(getSkillTool, allowlistMiddleware),
        wrapToolWithAllowlist(createCommandProbeTool(), allowlistMiddleware),
        wrapToolWithAllowlist(createListFoldersTool({ defaultCwd, onProgress }), allowlistMiddleware),
        wrapToolWithAllowlist(createListFoldersBatchTool({ defaultCwd, onProgress }), allowlistMiddleware),
        wrapToolWithAllowlist(createListFolderContentsBySizeTool({ defaultCwd, onProgress }), allowlistMiddleware),
        wrapToolWithAllowlist(createChangeDirectoryTool({ defaultCwd }), allowlistMiddleware),
        wrapToolWithAllowlist(createGetFolderCapacityTool({ defaultCwd, onProgress }), allowlistMiddleware),
        wrapToolWithAllowlist(createGetFolderCapacityBatchTool({ defaultCwd, onProgress }), allowlistMiddleware),
      ];

      const extraTools = getExtraToolsForReport(provider, reportAccumulator, scriptAccumulator);
      const tools = [...baseTools, ...extraTools];

      const agent = createLangchainAgent({
        model,
        tools,
        systemPrompt: SYSTEM_PROMPT,
      });

      return agent;
    },

    async invoke(threadId: string, userContent: string): Promise<string> {
      const graph = this.getGraph(undefined, undefined);
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
