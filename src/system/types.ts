/**
 * Provider model — supported types and stored shape.
 */
export type ProviderType = "openai" | "anthropic";

export interface Provider {
  id: string;
  type: ProviderType;
  apiKey?: string;
}

export interface AppConfig {
  providers: Provider[];
}
