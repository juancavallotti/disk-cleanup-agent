/**
 * cleanup command: report, clean, view subcommands.
 */

import { Command } from "commander";
import type { BootstrapContext } from "@/system/bootstrap.js";
import { runCleanupReport } from "./cleanupReport.js";
import { runCleanupScript } from "./cleanupScript.js";
import { runCleanupReportView } from "./cleanupReportView.js";

export function createCleanupCommand(context: BootstrapContext): Command {
  const cleanup = new Command("cleanup").description("Disk cleanup: generate report, produce script, or view reports");

  cleanup
    .command("report")
    .description("Generate a cleanup report (agent explores and reports opportunities)")
    .action(async () => {
      await runCleanupReport(context);
    });

  cleanup
    .command("script")
    .description("Generate a cleanup script (agent produces shell script, shown in browser)")
    .action(async () => {
      await runCleanupScript(context);
    });

  cleanup
    .command("view")
    .description("View a saved report (list and pick with inquirer if multiple)")
    .action(async () => {
      await runCleanupReportView(context);
    });

  return cleanup;
}
