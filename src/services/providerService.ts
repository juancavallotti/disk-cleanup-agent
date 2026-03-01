/**
 * Provider service: add, list, delete model providers.
 * Persists via config service; supports openai and anthropic.
 */

import type { ConfigService } from "@/system/configService.js";
import type { Provider, ProviderType } from "@/system/types.js";

const VALID_TYPES: ProviderType[] = ["openai", "anthropic"];

function isProviderType(s: string): s is ProviderType {
  return VALID_TYPES.includes(s as ProviderType);
}

function generateId(type: ProviderType, existing: Provider[]): string {
  const prefix = `${type}-`;
  const existingIds = new Set(existing.map((p) => p.id));
  let n = 1;
  while (existingIds.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export interface AddProviderInput {
  type: ProviderType;
  id?: string;
  apiKey: string;
}

export class ProviderService {
  constructor(private readonly configService: ConfigService) {}

  listProviders(): Provider[] {
    return [...this.configService.getConfig().providers];
  }

  addProvider(input: AddProviderInput): void {
    const { type, apiKey } = input;
    if (!isProviderType(type)) {
      throw new Error(`Invalid provider type: ${type}. Must be one of: ${VALID_TYPES.join(", ")}`);
    }
    if (!apiKey || apiKey.trim() === "") {
      throw new Error("API key is required");
    }
    const providers = this.listProviders();
    const id = input.id?.trim() || generateId(type, providers);
    if (providers.some((p) => p.id === id)) {
      throw new Error(`Provider with id "${id}" already exists`);
    }
    this.configService.updateConfig((config) => {
      config.providers.push({ id, type, apiKey: apiKey.trim() });
    });
  }

  deleteProvider(id: string): void {
    const trimmed = id.trim();
    const providers = this.listProviders();
    if (!providers.some((p) => p.id === trimmed)) {
      throw new Error(`Provider with id "${trimmed}" not found`);
    }
    this.configService.updateConfig((config) => {
      const index = config.providers.findIndex((p) => p.id === trimmed);
      if (index !== -1) config.providers.splice(index, 1);
    });
  }
}
