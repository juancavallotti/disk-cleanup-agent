/**
 * System bootstrap: config, state, provider check, agent (with allowlist middleware and in-memory checkpointer), and context for CLI.
 * If no providers exist, runs add-provider workflow; if user does not complete, exits.
 */

import { ConfigService } from "./configService.js";
import { StateService } from "./stateService.js";
import { ProviderService } from "@/services/providerService.js";
import { createAllowlistMiddleware } from "@/agent/allowlistMiddleware.js";
import { createAgent } from "@/agent/agent.js";
import type { DiskCleanupAgent } from "@/agent/agent.js";
import { createUserInputQueue } from "@/cli/userInputQueue.js";
import type { UserInputQueue } from "@/cli/userInputQueue.js";

export interface BootstrapContext {
  configService: ConfigService;
  stateService: StateService;
  providerService: ProviderService;
  agent: DiskCleanupAgent;
  /** Recreate the agent so it uses the current selected provider (e.g. after provider select). */
  recreateAgent(): void;
  /** User input queue for the CLI coordinator; used during cleanup report and other flows that need prompts. */
  userInputQueue: UserInputQueue;
}

export type RunAddProviderWorkflow = (providerService: ProviderService) => Promise<boolean>;

export interface BootstrapOptions {
  appName: string;
  /** When no providers exist, run this. Return true if user added at least one provider. */
  runAddProviderWorkflow?: RunAddProviderWorkflow;
}

/**
 * Bootstrap the system. Creates config and state services, ensures at least one provider.
 * If there are no providers and runAddProviderWorkflow is not provided or returns false, process.exit(1).
 */
export async function bootstrap(options: BootstrapOptions): Promise<BootstrapContext> {
  const { appName, runAddProviderWorkflow } = options;
  const configService = new ConfigService({ appName });
  configService.loadConfig();

  const stateService = new StateService({ appName });
  stateService.load();

  const providerService = new ProviderService(configService);
  const providers = providerService.listProviders();

  if (providers.length === 0) {
    if (!runAddProviderWorkflow) {
      console.error("No model provider configured. Add at least one provider to continue.");
      process.exit(1);
    }
    const completed = await runAddProviderWorkflow(providerService);
    if (!completed) {
      console.error("Add-provider workflow was not completed. Exiting.");
      process.exit(1);
    }
  }

  const userInputQueue = createUserInputQueue();
  const allowlistMiddleware = createAllowlistMiddleware(stateService, {
    requestUserInput: (options) => userInputQueue.requestInput(options),
  });

  const agentRef: { current: DiskCleanupAgent } = {
    current: createAgent({
      stateService,
      providerService,
      allowlistMiddleware,
    }),
  };

  const selected = agentRef.current.getProvider();
  console.log(`Selected provider: ${selected.id} (${selected.type})`);

  return {
    configService,
    stateService,
    providerService,
    get agent(): DiskCleanupAgent {
      return agentRef.current;
    },
    recreateAgent(): void {
      agentRef.current = createAgent({
        stateService,
        providerService,
        allowlistMiddleware,
      });
    },
    userInputQueue,
  };
}
