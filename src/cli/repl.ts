/**
 * Interactive REPL: readline loop, dispatch to command handlers.
 * Exit on "quit" / "exit" or Ctrl-C.
 */

import * as readline from "node:readline";
import type { BootstrapContext } from "@/system/bootstrap.js";
import { runAddProviderWorkflow } from "./addProviderWorkflow.js";
import { handleListProviders } from "./listProviders.js";
import { handleDeleteProvider } from "./deleteProvider.js";

const PROMPT = "disk-cleanup> ";
const QUIT_INPUTS = ["quit", "exit"];

function isQuit(input: string): boolean {
  return QUIT_INPUTS.includes(input.trim().toLowerCase());
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
        case "add-provider": {
          rl.pause();
          try {
            const completed = await runAddProviderWorkflow({
              providerService: context.providerService,
            });
            if (!completed) {
              console.error("Add-provider was cancelled or failed.");
            }
          } finally {
            rl.resume();
          }
          break;
        }
        case "list-providers":
          handleListProviders(context.providerService);
          break;
        case "delete-provider":
          handleDeleteProvider(context.providerService, args[0] ?? "");
          break;
        case "":
          break;
        default:
          console.log("Unknown command. Use: add-provider, list-providers, delete-provider <id>, quit");
      }
      loop();
    });
  };

  loop();
}
