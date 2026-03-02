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
/** Per-provider list of allowed tool names: Record<providerId, string[]>. */
export const TOOL_ALLOWLIST_KEY = "toolAllowlist";
/** Per-provider, per-tool, per-arg allowed values: Record<providerId, Record<toolName, Record<argName, string[]>>>. */
export const TOOL_ALLOWED_ARGS_KEY = "toolAllowedArgs";

export interface AppConfig {
  providers: Provider[];
  /** Max agent graph steps per run (plan + execution). Default 100. */
  recursionLimit?: number;
}
