/**
 * Commander program: cleanup (report, clean, view). If no subcommand, fall back to REPL.
 * Help text for the REPL is derived from this program so it stays in sync.
 */

import { Command } from "commander";
import type { BootstrapContext } from "@/system/bootstrap.js";
import { createCleanupCommand } from "./cleanupCommand.js";

export function buildProgram(context: BootstrapContext): Command {
  const program = new Command();
  program.name("disk-cleanup").description("CLI for disk cleanup reports and cleanup");
  program.addCommand(createCleanupCommand(context));
  return program;
}

const PROVIDER_HELP_LINES = `
  provider add       Add a model provider (OpenAI or Anthropic)
  provider list      List configured providers
  provider select    Select the provider to use (interactive)
  provider delete <id>  Remove a provider by id
`.trim();

/**
 * Build REPL help from the Commander program so cleanup commands and descriptions stay in sync.
 */
export function getReplHelpText(context: BootstrapContext): string {
  const program = buildProgram(context);
  const cleanupCmd = program.commands.find((c) => c.name() === "cleanup");
  const cleanupLines = cleanupCmd
    ? cleanupCmd.commands.map((sub) => `  cleanup ${sub.name().padEnd(6)} ${sub.description()}`).join("\n")
    : "";

  return [
    "Commands (by module):",
    "",
    PROVIDER_HELP_LINES,
    "",
    cleanupLines,
    "",
    "  help               Show this message",
    "  quit, exit         Exit the app",
  ].join("\n");
}
