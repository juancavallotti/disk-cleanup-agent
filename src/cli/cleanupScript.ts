/**
 * cleanup script — select a cleanup report, generate a shell script from it, then show it in a browser with syntax highlighting.
 * If there are no reports, suggests running "cleanup report" first.
 */

import select from "@inquirer/select";
import { HumanMessage } from "@langchain/core/messages";
import type { BootstrapContext } from "@/system/bootstrap.js";
import {
  runStreamTask,
  runCoordinatorLoop,
  type StreamSharedState,
} from "./streamDisplay.js";
import type { ScriptAccumulator } from "@/agent/tools/submitCleanupScript.js";
import { ScriptService } from "@/services/scriptService.js";
import { ReportService } from "@/services/reportService.js";
import { scriptToHtml } from "@/services/scriptToHtml.js";
import { getPlatformName } from "@/agent/tools/systemPaths.js";
import { formatBytes } from "@/services/reportToHtml.js";
import type { CleanupReport } from "@/services/reportTypes.js";
import { writeFileSync, existsSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

function buildScriptTaskFromReport(report: CleanupReport): string {
  const lines: string[] = [
    "The user selected a cleanup report. Generate a shell script that performs the cleanups listed below.",
    "Do not explore the filesystem—use only get_system_type and submit_cleanup_script.",
    "Call the skills tool with skill name \"script\" for format guidance (bash vs PowerShell), then produce the script from these opportunities and call submit_cleanup_script with the full script content.",
    "",
    "## Cleanup opportunities from the report",
  ];
  for (const opp of report.opportunities) {
    lines.push(`- path: ${opp.path}`);
    lines.push(`  pathDescription: ${opp.pathDescription}`);
    lines.push(`  sizeBytes: ${opp.sizeBytes} (${formatBytes(opp.sizeBytes)})`);
    lines.push(`  contentsDescription: ${opp.contentsDescription}`);
    lines.push(`  whySafeToDelete: ${opp.whySafeToDelete}`);
    if (opp.suggestedAction) {
      lines.push(`  suggestedAction: ${opp.suggestedAction}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

const TEMP_SUBDIR = "disk-cleanup";
const tempPathsToDelete = new Set<string>();

function registerTempForCleanup(filePath: string): void {
  tempPathsToDelete.add(filePath);
  if (tempPathsToDelete.size === 1) {
    process.on("exit", () => {
      for (const p of tempPathsToDelete) {
        try {
          if (existsSync(p)) unlinkSync(p);
        } catch {
          // ignore
        }
      }
    });
  }
}

function openInBrowser(filePath: string): void {
  const platform = process.platform;
  const quoted = `"${filePath.replace(/"/g, '\\"')}"`;
  if (platform === "darwin") {
    execSync(`open ${quoted}`);
  } else if (platform === "linux") {
    execSync(`xdg-open ${quoted}`);
  } else if (platform === "win32") {
    execSync(`start "" ${quoted}`);
  }
}

function shellTypeToExtension(
  shellType: "mac" | "windows" | "linux"
): ".sh" | ".ps1" {
  return shellType === "windows" ? ".ps1" : ".sh";
}

export async function runCleanupScript(context: BootstrapContext): Promise<void> {
  const { agent, configService, userInputQueue } = context;

  const reportService = new ReportService({ configService });
  const reportPaths = reportService.listReports();

  if (reportPaths.length === 0) {
    console.log("No reports found. Run 'cleanup report' first.");
    return;
  }

  let chosenReportPath: string;
  if (reportPaths.length === 1) {
    chosenReportPath = reportPaths[0];
  } else {
    process.stdout.write("\n\n");
    const choice = await select({
      message: "Select a report to generate a script from",
      choices: reportPaths.map((p) => ({ name: p, value: p })),
    });
    chosenReportPath = choice;
  }

  const report = reportService.getReport(chosenReportPath);
  if (!report) {
    console.error("Could not load report.");
    return;
  }

  const platform = getPlatformName();
  const shellType: "mac" | "windows" | "linux" =
    platform === "windows" ? "windows" : platform === "mac" ? "mac" : "linux";
  const extension = shellTypeToExtension(shellType);

  const scriptService = new ScriptService({ configService });
  const scriptPath = scriptService.getNextScriptPath(extension);

  const accumulator: ScriptAccumulator = {
    scriptPath,
    scriptContent: null,
    shellType,
  };

  const recursionLimit = configService.getConfig().recursionLimit ?? 100;
  const scriptTask = buildScriptTaskFromReport(report);

  console.log("\nGenerating cleanup script from report...\n");

  const sharedState: StreamSharedState = {
    lastChunk: null,
    toolProgress: null,
    done: false,
  };

  const graph = agent.getGraph(undefined, accumulator, {
    thinkingStreamWriter: (text) => {
      sharedState.toolProgress = text.replace(/\r\n|\r|\n/g, " ").trim();
    },
  });

  const stream = await graph.stream(
    { messages: [new HumanMessage(scriptTask)] },
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

  if (aborted) {
    console.log("\nAborted.");
    return;
  }

  if (!accumulator.scriptContent) {
    console.log("\nNo script was produced. The agent may not have called submit_cleanup_script.");
    return;
  }

  const html = scriptToHtml({
    scriptPath: accumulator.scriptPath,
    scriptContent: accumulator.scriptContent,
    shellType: accumulator.shellType,
  });

  const tempDir = join(tmpdir(), TEMP_SUBDIR);
  mkdirSync(tempDir, { recursive: true });
  const id = new Date().toISOString().replace(/[:.]/g, "-").replace(/Z$/, "Z");
  const htmlPath = join(tempDir, `script-${id}.html`);
  writeFileSync(htmlPath, html, "utf-8");
  registerTempForCleanup(htmlPath);
  openInBrowser(htmlPath);

  console.log(`\nScript saved: ${accumulator.scriptPath}`);
  console.log("Script view opened in browser. (Temp file will be removed when you exit.)");
}
