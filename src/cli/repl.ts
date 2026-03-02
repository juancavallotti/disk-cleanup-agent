/**
 * Interactive REPL: readline loop, dispatch to command handlers.
 * Exit on "quit" / "exit" or Ctrl-C.
 */

import * as readline from "node:readline";
import type { BootstrapContext } from "@/system/bootstrap.js";
import { runAddProviderWorkflow } from "./addProviderWorkflow.js";
import { handleListProviders } from "./listProviders.js";
import { handleDeleteProvider } from "./deleteProvider.js";
import { handleSelectProvider } from "./selectProvider.js";
import { getReplHelpText } from "./program.js";
import { runCleanupReport } from "./cleanupReport.js";
import { runCleanupClean } from "./cleanupClean.js";
import { runCleanupReportView } from "./cleanupReportView.js";

const PROMPT = "disk-cleanup> ";
const QUIT_INPUTS = ["quit", "exit"];

const PROVIDER_HELP_TEXT = `
Provider commands:

  provider add         Add a model provider (OpenAI or Anthropic)
  provider list        List configured providers
  provider select      Select the provider to use (interactive)
  provider delete <id> Remove a provider by id
`;

function isQuit(input: string): boolean {
  return QUIT_INPUTS.includes(input.trim().toLowerCase());
}

function showHelp(context: BootstrapContext): void {
  console.log(getReplHelpText(context));
}

export function parseLine(line: string): { command: string; args: string[] } {
  const parts = line.trim().split(/\s+/).filter(Boolean);
  const command = parts[0] ?? "";
  const args = parts.slice(1);
  return { command, args };
}

export function startRepl(context: BootstrapContext): void {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const exit = (): void => {
    rl.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    rl.close();
    process.exit(0);
  });

  const loop = (): void => {
    rl.question(PROMPT, async (line) => {
      if (isQuit(line)) {
        exit();
        return;
      }
      const { command, args } = parseLine(line);
      switch (command) {
        case "help":
          showHelp(context);
          break;
        case "cleanup": {
          const sub = args[0]?.toLowerCase();
          if (sub === "report") {
            rl.pause();
            try {
              await runCleanupReport(context);
            } finally {
              rl.resume();
            }
          } else if (sub === "clean") {
            runCleanupClean();
          } else if (sub === "view") {
            rl.pause();
            try {
              await runCleanupReportView(context);
            } finally {
              rl.resume();
            }
          } else if (sub) {
            console.log("Unknown cleanup command. Type 'help' for cleanup report, clean, view.");
          } else {
            console.log("cleanup <report|clean|view>. Type 'help' for details.");
          }
          break;
        }
        case "provider": {
          const sub = args[0]?.toLowerCase();
          if (sub === "add") {
            rl.pause();
            try {
              const completed = await runAddProviderWorkflow({
                providerService: context.providerService,
              });
              if (!completed) {
                console.error("Provider add was cancelled or failed.");
              }
            } finally {
              rl.resume();
            }
          } else if (sub === "list") {
            handleListProviders(context.providerService);
          } else if (sub === "select") {
            rl.pause();
            try {
              await handleSelectProvider(context.providerService, context.stateService);
              context.recreateAgent();
            } finally {
              rl.resume();
            }
          } else if (sub === "delete") {
            handleDeleteProvider(context.providerService, args[1] ?? "");
          } else if (sub) {
            console.log("Unknown provider command. Type 'provider' for available commands.");
          } else {
            console.log(PROVIDER_HELP_TEXT.trim());
          }
          break;
        }
        case "":
          break;
        default:
          console.log("Unknown command. Type 'help' for available commands.");
      }
      loop();
    });
  };

  loop();
}
