#!/usr/bin/env node

import { bootstrap } from "@/system/bootstrap.js";
import { runAddProviderWorkflow } from "@/cli/addProviderWorkflow.js";
import { startRepl } from "@/cli/repl.js";

const APP_NAME = "disk-cleanup";

async function main(): Promise<void> {
  const context = await bootstrap({
    appName: APP_NAME,
    runAddProviderWorkflow: (providerService) =>
      runAddProviderWorkflow({ providerService }),
  });
  startRepl(context);
}

main();
