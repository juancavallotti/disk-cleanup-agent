/**
 * Commander program: cleanup (report, script, view). If no subcommand, fall back to REPL.
 * Help text for the REPL is derived from this program so it stays in sync.
 */

import { Command } from "commander";
import type { BootstrapContext } from "@/system/bootstrap.js";
import { createCleanupCommand } from "./cleanupCommand.js";
import { SELECTED_PROVIDER_ID_KEY } from "@/system/types.js";

export function buildProgram(context: BootstrapContext): Command {
  const program = new Command();
  program.name("disk-cleanup").description("CLI for disk cleanup reports and cleanup");
  program.addCommand(createCleanupCommand(context));
  return program;
}

const PROVIDER_COMMAND_LINES = `
  provider add       Add a model provider (OpenAI or Anthropic)
  provider list      List configured providers
  provider select    Select the provider to use (interactive)
  provider delete [id]  Remove a provider (interactive if no id)
`.trim();

/**
 * Resolve current provider for display (selected if set and in list, else first).
 */
function getCurrentProviderDisplay(context: BootstrapContext): string {
  const providers = context.providerService.listProviders();
  if (providers.length === 0) return "(none)";
  const selectedId = context.stateService.getState()[SELECTED_PROVIDER_ID_KEY] as string | undefined;
  const found = selectedId ? providers.find((p) => p.id === selectedId) : null;
  const current = found ?? providers[0];
  return `${current.id} (${current.type})`;
}

/**
 * Provider help section including current provider and command list.
 */
export function getProviderHelpSection(context: BootstrapContext): string {
  const current = getCurrentProviderDisplay(context);
  return [`Current provider: ${current}`, "", PROVIDER_COMMAND_LINES].join("\n");
}

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
    getProviderHelpSection(context),
    "",
    cleanupLines,
    "",
    "  clear              Clear the console",
    "  help               Show this message",
    "  quit, exit         Exit the app",
  ].join("\n");
}
