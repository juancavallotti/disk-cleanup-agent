/**
 * cleanup report — run agent with streaming, write YAML report to app reports dir.
 */

import { HumanMessage } from "@langchain/core/messages";
import type { BootstrapContext } from "@/system/bootstrap.js";
import {
  consumeStreamWithTwoLines,
  clearStreamArea,
  prepareForStreamResume,
} from "./streamDisplay.js";
import type { ReportAccumulator } from "@/agent/tools/reportCleanupOpportunity.js";
import type { CleanupReport, CleanupOpportunity } from "@/services/reportTypes.js";
import { DEFAULT_BACKUP_WARNING } from "@/services/reportTypes.js";
import { ReportService } from "@/services/reportService.js";
import { getPlatformName } from "@/agent/tools/systemPaths.js";

const REPORT_TASK =
  "Generate a disk cleanup report. First output your game plan (which directories you will inspect, only user locations—never system folders). Then execute the plan using your tools. Use get_folder_capacity_batch when measuring multiple paths. For each location that is safe to clean, call report_cleanup_opportunity with path, pathDescription, sizeBytes, contentsDescription, whySafeToDelete, and optional suggestedAction. When done, summarize.";

export async function runCleanupReport(context: BootstrapContext): Promise<void> {
  const { agent, configService, streamDisplayCallbacksRef } = context;

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

  streamDisplayCallbacksRef.current = {
    onBeforeUserInput: clearStreamArea,
    onAfterUserInput: prepareForStreamResume,
  };

  const graph = agent.getGraph(accumulator);
  const stream = await graph.stream(
    { messages: [new HumanMessage(REPORT_TASK)] },
    { streamMode: "values" }
  );

  let aborted = false;
  try {
    await consumeStreamWithTwoLines(stream, {
      onAbort: () => {
        aborted = true;
      },
    });
  } finally {
    streamDisplayCallbacksRef.current = null;
  }

  const reportService = new ReportService({ configService });
  const savedPath = reportService.saveReport(report);
  if (!aborted) {
    console.log(`\nReport saved: ${savedPath}`);
  }
}
