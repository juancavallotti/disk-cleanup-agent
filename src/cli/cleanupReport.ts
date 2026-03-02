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
  consumeStreamWithTwoLines,
  type StreamSharedState,
} from "./streamDisplay.js";
import type { ReportAccumulator } from "@/agent/tools/reportCleanupOpportunity.js";
import type { CleanupReport, CleanupOpportunity } from "@/services/reportTypes.js";
import { DEFAULT_BACKUP_WARNING } from "@/services/reportTypes.js";
import { ReportService } from "@/services/reportService.js";
import { getPlatformName } from "@/agent/tools/systemPaths.js";

const PLAN_PROMPT = `You are planning a disk cleanup. Output ONLY an execution plan as ASCII bullet points. Do not use any tools.
List which directories you will inspect (only user locations: home, caches in home—never system folders like /System, /Library, /usr). One bullet per step, in order. Keep it short and concrete. No other text.`;

const REPORT_TASK =
  "Generate a disk cleanup report. First output your game plan (which directories you will inspect, only user locations—never system folders). Then execute the plan using your tools. Use get_folder_capacity_batch when measuring multiple paths. For each location that is safe to clean, call report_cleanup_opportunity with path, pathDescription, sizeBytes, contentsDescription, whySafeToDelete, and optional suggestedAction. When done, summarize.";

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

  const report: CleanupReport = {
    generatedAt: new Date().toISOString(),
    system: getPlatformName(),
    backupWarning: DEFAULT_BACKUP_WARNING,
    opportunities: [],
  };

  const accumulator: ReportAccumulator = {
    push(opp: CleanupOpportunity) {
      report.opportunities.push(opp);
    },
  };

  console.log("\nGenerating execution plan...\n");

  const graph = agent.getGraph(accumulator);
  const planStream = await graph.stream(
    { messages: [new HumanMessage(PLAN_PROMPT)] },
    { streamMode: "values" }
  );
  const planResult = await consumeStreamWithTwoLines(planStream);
  const planPhaseMessages = planResult.messages;
  const rawPlan = getPlanTextFromMessages(planPhaseMessages);
  const planBullets = formatPlanAsBullets(rawPlan);
  console.log("\nExecution plan:\n");
  console.log(planBullets);
  console.log("");

  // Plan confirmation via user input queue; coordinator drains it.
  const planAcceptPromise = userInputQueue.requestInput({
    message: "Accept this plan and proceed? [y/n]",
    validate: YN_VALIDATE,
  });
  const planSharedState: StreamSharedState = { lastChunk: null, toolProgress: null, done: true };
  await runCoordinatorLoop(planSharedState, userInputQueue);
  const acceptAnswer = await planAcceptPromise;
  if (acceptAnswer.trim().toLowerCase() !== "y") {
    console.log("Plan not accepted. Exiting.");
    return;
  }

  const executionMessage =
    `The user approved the following execution plan:\n\n${planBullets}\n\n` +
    "Now execute this plan using your tools. " +
    REPORT_TASK;

  const sharedState: StreamSharedState = { lastChunk: null, toolProgress: null, done: false };
  const executionGraph = agent.getGraph(accumulator, {
    thinkingStreamWriter: (text) => {
      sharedState.toolProgress = text;
    },
  });
  const stream = await executionGraph.stream(
    { messages: [...planPhaseMessages, new HumanMessage(executionMessage)] },
    { streamMode: "values" }
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
  }
}
