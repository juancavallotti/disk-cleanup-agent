#!/usr/bin/env node

import "dotenv/config";

import { bootstrap } from "@/system/bootstrap.js";
import { runAddProviderWorkflow } from "@/cli/addProviderWorkflow.js";
import { startRepl } from "@/cli/repl.js";
import { buildProgram } from "@/cli/program.js";

const APP_NAME = "disk-cleanup";

async function main(): Promise<void> {
  const context = await bootstrap({
    appName: APP_NAME,
    runAddProviderWorkflow: (providerService) =>
      runAddProviderWorkflow({ providerService }),
  });

  const program = buildProgram(context);
  const args = process.argv.slice(2);
  const cleanupSubs = ["report", "clean", "view"];
  const hasCleanupSub = args[0] === "cleanup" && args[1] && cleanupSubs.includes(args[1]);

  if (hasCleanupSub) {
    await program.parseAsync(process.argv);
    process.exit(0);
  }

  startRepl(context);
}

main();
