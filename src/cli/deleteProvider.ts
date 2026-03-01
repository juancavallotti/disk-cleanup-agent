/**
 * delete-provider <id> command: remove a provider by id.
 */

import type { ProviderService } from "@/services/providerService.js";

export function handleDeleteProvider(providerService: ProviderService, id: string): void {
  if (!id.trim()) {
    console.error("Usage: delete-provider <id>");
    return;
  }
  try {
    providerService.deleteProvider(id);
    console.log(`Provider "${id.trim()}" deleted.`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
  }
}
