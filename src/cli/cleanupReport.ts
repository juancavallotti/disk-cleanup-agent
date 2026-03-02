/**
 * cleanup report — run agent with streaming, write YAML report to app reports dir.
 * Flow: run agent graph for plan (same agent, shared context) → show plan → user accepts → run same graph with execution message (shared context).
 */

import { HumanMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import type { BootstrapContext } from "@/system/bootstrap.js";
import {
  runStreamTask,
  runCoordinatorLoop,
  type StreamSharedState,
} from "./streamDisplay.js";
import type { ReportAccumulator } from "@/agent/tools/reportCleanupOpportunity.js";
import type { CleanupReport, CleanupOpportunity } from "@/services/reportTypes.js";
import { DEFAULT_BACKUP_WARNING } from "@/services/reportTypes.js";
import { ReportService } from "@/services/reportService.js";
import { viewReportAtPath } from "./cleanupReportView.js";
import { getPlatformName } from "@/agent/tools/systemPaths.js";
import { getModelId } from "@/agent/chatModel.js";

const PLAN_PROMPT = `The user requested a cleanup report. Call the skills tool with skill name "report" to load the task instructions. Then output ONLY an execution plan as ASCII bullet points: list which directories you will inspect (only user locations—never system folders like /System, /Library, /usr). One bullet per step, in order. Do not use any other tools yet.`;

const REPORT_TASK =
  "Execute the plan using your tools. You already have the report skill loaded; use get_folder_capacity_batch when measuring multiple paths. For each location that is safe to clean, call report_cleanup_opportunity with opportunities: an array of { path, pathDescription, sizeBytes, contentsDescription, whySafeToDelete, optional suggestedAction }. When done, summarize.";

const YN_VALIDATE = (v: string): true | string => {
  const lower = v.trim().toLowerCase();
  if (lower === "y" || lower === "n") return true;
  return "Enter y or n";
};

/** Normalize plan text to ASCII bullet points (each non-empty line starts with "- "). */
function formatPlanAsBullets(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => (line.match(/^[-*]\s/) ? line : `- ${line}`))
    .join("\n");
}

/** Extract plan text from the last AI message in the conversation. */
function getPlanTextFromMessages(messages: BaseMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const type = (m as { _getType?: () => string })._getType?.() ?? (m as { type?: string }).type;
    if (type === "ai") {
      const content = (m as { content?: unknown }).content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content
          .map((block) => (typeof block === "string" ? block : (block as { text?: string }).text ?? ""))
          .join("\n");
      }
      return String(content ?? "");
    }
  }
  return "";
}

export async function runCleanupReport(context: BootstrapContext): Promise<void> {
  const { agent, configService, userInputQueue } = context;

  const provider = agent.getProvider();
  const report: CleanupReport = {
    generatedAt: new Date().toISOString(),
    system: getPlatformName(),
    backupWarning: DEFAULT_BACKUP_WARNING,
    model: getModelId(provider),
    opportunities: [],
  };

  const accumulator: ReportAccumulator = {
    push(opp: CleanupOpportunity) {
      report.opportunities.push(opp);
    },
  };

  const recursionLimit = configService.getConfig().recursionLimit ?? 100;

  console.log("\nGenerating execution plan...\n");

  const planSharedState: StreamSharedState = {
    lastChunk: null,
    toolProgress: null,
    done: false,
  };
  const planGraph = agent.getGraph(accumulator, undefined);
  const planStream = await planGraph.stream(
    { messages: [new HumanMessage(PLAN_PROMPT)] },
    { streamMode: "values", recursionLimit }
  );

  const planTaskPromise = runStreamTask(planStream, planSharedState, {
    setDoneOnComplete: false,
  });
  const planCoordinatorPromise = runCoordinatorLoop(planSharedState, userInputQueue);

  await planTaskPromise;

  const planPhaseMessages = planSharedState.lastChunk?.messages ?? [];
  const rawPlan = getPlanTextFromMessages(planPhaseMessages);
  const planBullets = formatPlanAsBullets(rawPlan);
  console.log("\nExecution plan:\n");
  console.log(planBullets);
  console.log("");

  const planAcceptPromise = userInputQueue.requestInput({
    message: "Accept this plan and proceed? [y/n]",
    validate: YN_VALIDATE,
  });
  const acceptAnswer = await planAcceptPromise;
  planSharedState.done = true;
  await planCoordinatorPromise;

  if (acceptAnswer.trim().toLowerCase() !== "y") {
    console.log("Plan not accepted. Exiting.");
    return;
  }

  const executionMessage =
    `The user approved the following execution plan:\n\n${planBullets}\n\n` +
    "Now execute this plan using your tools. " +
    REPORT_TASK;

  const sharedState: StreamSharedState = {
    lastChunk: null,
    toolProgress: null,
    done: false,
  };
  const executionGraph = agent.getGraph(accumulator, undefined, {
    thinkingStreamWriter: (text) => {
      sharedState.toolProgress = text;
    },
  });
  const stream = await executionGraph.stream(
    { messages: [...planPhaseMessages, new HumanMessage(executionMessage)] },
    { streamMode: ["values", "messages"], recursionLimit }
  );

  let aborted = false;

  const streamTaskPromise = runStreamTask(stream, sharedState, {
    onAbort: () => {
      aborted = true;
    },
  });

  await runCoordinatorLoop(sharedState, userInputQueue, {
    onAbort: () => {
      aborted = true;
    },
  });

  await streamTaskPromise;

  const reportService = new ReportService({ configService });
  const savedPath = reportService.saveReport(report);
  if (!aborted) {
    console.log(`\nReport saved: ${savedPath}`);
    viewReportAtPath(configService, savedPath);
    console.log("Report opened in browser. (Temp file will be removed when you exit.)");
  }
}
