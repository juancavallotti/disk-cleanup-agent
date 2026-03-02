/**
 * Provider model — supported types and stored shape.
 */
export type ProviderType = "openai" | "anthropic";

export interface Provider {
  id: string;
  type: ProviderType;
  apiKey?: string;
  /** Optional model override (e.g. gpt-4o-mini, claude-3-5-haiku-*). */
  model?: string;
}

/** State keys for state service (single source of truth). */
export const SELECTED_PROVIDER_ID_KEY = "selectedProviderId";
export const TOOL_ALLOWLIST_KEY = "toolAllowlist";
export const TOOL_AUTHORIZATION_STATUS_KEY = "toolAuthorizationStatus";

export interface AppConfig {
  providers: Provider[];
  /** Max agent graph steps per run (plan + execution). Default 100. */
  recursionLimit?: number;
}
