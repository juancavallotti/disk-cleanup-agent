/**
 * provider select — inquirer select to choose the active provider.
 * Persists selection in state (selectedProviderId).
 */

import select from "@inquirer/select";
import type { ProviderService } from "@/services/providerService.js";
import type { StateService } from "@/system/stateService.js";
import type { Provider } from "@/system/types.js";

const STATE_KEY_SELECTED_PROVIDER_ID = "selectedProviderId";

export async function handleSelectProvider(
  providerService: ProviderService,
  stateService: StateService
): Promise<void> {
  const providers = providerService.listProviders();
  if (providers.length === 0) {
    console.log("No providers configured. Use 'provider add' first.");
    return;
  }

  const choices = providers.map((p: Provider) => ({
    name: `${p.id} (${p.type})`,
    value: p.id,
  }));

  const selectedId = await select({
    message: "Select provider to use (↑/↓ arrows, Enter to select)",
    choices,
  });

  stateService.setState((state) => {
    state[STATE_KEY_SELECTED_PROVIDER_ID] = selectedId;
  });
  console.log(`Provider "${selectedId}" is now selected.`);
}
