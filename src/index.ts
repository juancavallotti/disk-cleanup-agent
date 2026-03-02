#!/usr/bin/env node

import "dotenv/config";

import { bootstrap } from "@/system/bootstrap.js";
import { runAddProviderWorkflow } from "@/cli/addProviderWorkflow.js";
import { startRepl } from "@/cli/repl.js";
import { buildProgram } from "@/cli/program.js";

const APP_NAME = "disk-cleanup";

process.on("SIGUSR2", () => {
  console.error(new Error("Manual stack trace dump").stack);
});

if (process.env.ENV === "dev") {
  process.on("SIGINT", () => {
    console.error(new Error("SIGINT stack trace dump").stack);
    process.exit(130);
  });
}

console.error(`Process started with PID ${process.pid}`);
console.error(`Stack dump command: kill -SIGUSR2 ${process.pid}`);

async function main(): Promise<void> {
  const context = await bootstrap({
    appName: APP_NAME,
    runAddProviderWorkflow: (providerService) =>
      runAddProviderWorkflow({ providerService }),
  });

  const program = buildProgram(context);
  const args = process.argv.slice(2);
  const cleanupSubs = ["report", "script", "view"];
  const hasCleanupSub = args[0] === "cleanup" && args[1] && cleanupSubs.includes(args[1]);

  if (hasCleanupSub) {
    await program.parseAsync(process.argv);
    process.exit(0);
  }

  startRepl(context);
}

main();
