/**
 * provider delete [id] — remove a provider. Interactive select when no id given.
 */

import select from "@inquirer/select";
import type { BootstrapContext } from "@/system/bootstrap.js";
import type { Provider } from "@/system/types.js";
import { SELECTED_PROVIDER_ID_KEY } from "@/system/types.js";

const CANCEL_VALUE = "__cancel__";

export async function handleDeleteProvider(context: BootstrapContext, id: string): Promise<void> {
  const trimmedId = id.trim();

  if (trimmedId === "") {
    const providers = context.providerService.listProviders();
    if (providers.length === 0) {
      console.log("No providers configured. Use 'provider add' first.");
      return;
    }

    const choices = providers.map((p: Provider) => ({
      name: `${p.id} (${p.type})`,
      value: p.id,
    }));
    choices.push({ name: "Cancel", value: CANCEL_VALUE });

    const selectedId = await select({
      message: "Select provider to delete (↑/↓ arrows, Enter to select)",
      choices,
    });

    if (selectedId === CANCEL_VALUE) {
      return;
    }

    try {
      context.providerService.deleteProvider(selectedId);
      console.log(`Provider "${selectedId}" deleted.`);
      clearSelectionIfDeleted(context, selectedId);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
    }
    return;
  }

  try {
    context.providerService.deleteProvider(trimmedId);
    console.log(`Provider "${trimmedId}" deleted.`);
    clearSelectionIfDeleted(context, trimmedId);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
  }
}

function clearSelectionIfDeleted(context: BootstrapContext, deletedId: string): void {
  const state = context.stateService.getState();
  const selectedId = state[SELECTED_PROVIDER_ID_KEY] as string | undefined;
  if (selectedId === deletedId) {
    context.stateService.setState((s) => {
      delete s[SELECTED_PROVIDER_ID_KEY];
    });
    context.recreateAgent();
  }
}
