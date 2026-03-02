/**
 * Interactive add-provider workflow.
 * Provider type via arrow-key selection (with Quit option); shows API key instructions link.
 * Uses inquirer for all prompts so terminal handling is consistent.
 * Returns true if a provider was added, false if user quit.
 */

import select from "@inquirer/select";
import input from "@inquirer/input";
import type { ProviderService } from "@/services/providerService.js";
import type { ProviderType } from "@/system/types.js";

const QUIT_VALUE = "__quit__";
const QUIT_INPUTS = ["quit", "exit"];
const VALID_TYPES: ProviderType[] = ["openai", "anthropic"];

const PROVIDER_META: Record<
  ProviderType,
  { name: string; apiKeyUrl: string }
> = {
  openai: {
    name: "OpenAI (GPT models)",
    apiKeyUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    name: "Anthropic (Claude models)",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
  },
};

function isQuitInput(value: string): boolean {
  return QUIT_INPUTS.includes(value.trim().toLowerCase());
}

export interface AddProviderWorkflowOptions {
  providerService: ProviderService;
}

function exitOnSigint(): () => void {
  const handler = () => {
    process.exit(0);
  };
  process.on("SIGINT", handler);
  return () => process.off("SIGINT", handler);
}

/**
 * Run interactive add-provider. Returns true if at least one provider was added, false if user quit.
 */
export async function runAddProviderWorkflow(options: AddProviderWorkflowOptions): Promise<boolean> {
  const { providerService } = options;
  const removeSigint = exitOnSigint();
  try {
    return await runAddProviderWorkflowInner(providerService);
  } finally {
    removeSigint();
  }
}

async function runAddProviderWorkflowInner(providerService: ProviderService): Promise<boolean> {
  process.stdout.write("\n\n");
  const choice = await select({
    message: "Select provider type (↑/↓ arrows, Enter to select)",
    choices: [
      ...VALID_TYPES.map((t) => ({
        name: PROVIDER_META[t].name,
        value: t,
        description: `Get API key: ${PROVIDER_META[t].apiKeyUrl}`,
      })),
      { name: "Quit / Cancel", value: QUIT_VALUE },
    ],
  });

  if (choice === QUIT_VALUE) {
    return false;
  }

  const type = choice as ProviderType;
  const { apiKeyUrl, name } = PROVIDER_META[type];
  console.log(`\nGet your ${name} API key at: ${apiKeyUrl}\n`);
  process.stdout.write("\n\n");
  const idAnswer = await input({
    message: "Provider id (optional, press Enter to auto-generate)",
    default: "",
  });
  if (isQuitInput(idAnswer)) return false;

  process.stdout.write("\n\n");
  const apiKeyAnswer = await input({
    message: "API key",
    validate: (value) =>
      !value || value.trim() === "" ? "API key is required." : true,
  });
  if (isQuitInput(apiKeyAnswer)) return false;
  if (!apiKeyAnswer.trim()) {
    console.error("API key is required.");
    return false;
  }

  try {
    providerService.addProvider({
      type,
      id: idAnswer.trim() || undefined,
      apiKey: apiKeyAnswer.trim(),
    });
    console.log("Provider added successfully.");
    return true;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return false;
  }
}
