/**
 * System bootstrap: config, state, provider check, and context for CLI.
 * If no providers exist, runs add-provider workflow; if user does not complete, exits.
 */

import { ConfigService } from "./configService.js";
import { StateService } from "./stateService.js";
import { ProviderService } from "@/services/providerService.js";

export interface BootstrapContext {
  configService: ConfigService;
  stateService: StateService;
  providerService: ProviderService;
  /** Placeholder for future agent lifecycle */
  agent: null;
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

  return {
    configService,
    stateService,
    providerService,
    agent: null,
  };
}
