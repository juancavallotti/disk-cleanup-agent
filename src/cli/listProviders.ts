/**
 * list-providers command: print all configured providers (id, type).
 */

import type { ProviderService } from "@/services/providerService.js";

export function handleListProviders(providerService: ProviderService): void {
  const providers = providerService.listProviders();
  if (providers.length === 0) {
    console.log("No providers configured.");
    return;
  }
  for (const p of providers) {
    console.log(`  ${p.id} (${p.type})`);
  }
}
