/**
 * cleanup command: report, clean, view subcommands.
 */

import { Command } from "commander";
import type { BootstrapContext } from "@/system/bootstrap.js";
import { runCleanupReport } from "./cleanupReport.js";
import { runCleanupClean } from "./cleanupClean.js";
import { runCleanupReportView } from "./cleanupReportView.js";

export function createCleanupCommand(context: BootstrapContext): Command {
  const cleanup = new Command("cleanup").description("Disk cleanup: generate report, run clean, or view reports");

  cleanup
    .command("report")
    .description("Generate a cleanup report (agent explores and reports opportunities)")
    .action(async () => {
      await runCleanupReport(context);
    });

  cleanup
    .command("clean")
    .description("Execute cleanup from a report (stub)")
    .action(() => {
      runCleanupClean();
    });

  cleanup
    .command("view")
    .description("View a saved report (list and pick with inquirer if multiple)")
    .action(async () => {
      await runCleanupReportView(context);
    });

  return cleanup;
}
