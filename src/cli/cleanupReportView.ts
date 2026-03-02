/**
 * cleanup report view — list reports, inquirer if multiple, render as HTML in temp, open in browser, schedule deletion on exit.
 */

import select from "@inquirer/select";
import { writeFileSync, existsSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import type { ConfigService } from "@/system/configService.js";
import type { BootstrapContext } from "@/system/bootstrap.js";
import { ReportService } from "@/services/reportService.js";
import { reportToHtml } from "@/services/reportToHtml.js";

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

/**
 * Load a report from the given path, render to HTML in a temp file, open in browser.
 * Temp file is registered for deletion on process exit. Returns true if successful.
 */
export function viewReportAtPath(configService: ConfigService, reportPath: string): boolean {
  const reportService = new ReportService({ configService });
  const report = reportService.getReport(reportPath);
  if (!report) return false;
  const html = reportToHtml(report);
  const tempDir = join(tmpdir(), TEMP_SUBDIR);
  mkdirSync(tempDir, { recursive: true });
  const id = report.generatedAt.replace(/[:.]/g, "-").replace(/Z$/, "Z");
  const htmlPath = join(tempDir, `report-${id}.html`);
  writeFileSync(htmlPath, html, "utf-8");
  registerTempForCleanup(htmlPath);
  openInBrowser(htmlPath);
  return true;
}

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
    process.stdout.write("\n\n");
    const choice = await select({
      message: "Select a report to view",
      choices: paths.map((p) => ({ name: p, value: p })),
    });
    chosenPath = choice;
  }

  if (viewReportAtPath(configService, chosenPath)) {
    console.log("Report opened in browser. (Temp file will be removed when you exit.)");
  } else {
    console.error("Could not load report.");
  }
}
