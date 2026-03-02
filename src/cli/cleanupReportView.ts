/**
 * cleanup report view — list reports, inquirer if multiple, show backup warning and content (noop: path or YAML).
 */

import select from "@inquirer/select";
import type { BootstrapContext } from "@/system/bootstrap.js";
import { ReportService } from "@/services/reportService.js";
import { readFileSync } from "node:fs";
import { DEFAULT_BACKUP_WARNING } from "@/services/reportTypes.js";

export async function runCleanupReportView(context: BootstrapContext): Promise<void> {
  const { configService } = context;
  const reportService = new ReportService({ configService });
  const paths = reportService.listReports();

  if (paths.length === 0) {
    console.log("No reports found. Run 'cleanup report' first.");
    return;
  }

  let chosenPath: string;
  if (paths.length === 1) {
    chosenPath = paths[0];
  } else {
    const choice = await select({
      message: "Select a report to view",
      choices: paths.map((p) => ({ name: p, value: p })),
    });
    chosenPath = choice;
  }

  const report = reportService.getReport(chosenPath);
  if (!report) {
    console.error("Could not load report.");
    return;
  }

  console.log("\n--- Backup warning ---");
  console.log(report.backupWarning ?? DEFAULT_BACKUP_WARNING);
  console.log("\n--- Report ---");
  console.log("Path:", chosenPath);
  console.log("Generated:", report.generatedAt);
  console.log("System:", report.system);
  console.log("Opportunities:", report.opportunities?.length ?? 0);
  console.log("\n--- YAML content ---");
  const raw = readFileSync(chosenPath, "utf-8");
  console.log(raw);
}
