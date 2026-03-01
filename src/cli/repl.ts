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

const PROMPT = "disk-cleanup> ";
const QUIT_INPUTS = ["quit", "exit"];

const HELP_TEXT = `
Commands (by module):

  provider add       Add a model provider (OpenAI or Anthropic)
  provider list      List configured providers
  provider select    Select the provider to use (interactive)
  provider delete <id>  Remove a provider by id

  help               Show this message
  quit, exit         Exit the app
`;

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

function showHelp(): void {
  console.log(HELP_TEXT.trim());
}

function showProviderHelp(): void {
  console.log(PROVIDER_HELP_TEXT.trim());
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
          showHelp();
          break;
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
            } finally {
              rl.resume();
            }
          } else if (sub === "delete") {
            handleDeleteProvider(context.providerService, args[1] ?? "");
          } else if (sub) {
            console.log("Unknown provider command. Type 'provider' for available commands.");
          } else {
            showProviderHelp();
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
