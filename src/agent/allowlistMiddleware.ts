/**
 * Allowlist middleware: register allowed tools, persist per-tool allowed-args in state.
 * Tool authorization is human-in-the-loop: prompt only when (tool, args) is new; once allowed, same args are auto-allowed.
 */

import type { StateService } from "@/system/stateService.js";
import {
  TOOL_ALLOWLIST_KEY,
  TOOL_AUTHORIZATION_STATUS_KEY,
  TOOL_ALLOWED_ARGS_KEY,
} from "@/system/types.js";

/** Single source of truth for which tools participate in allowlist behavior. */
export const ALLOWLIST_TOOL_NAMES = [
  "get_skill",
  "list_folders",
  "list_folder_contents_by_size",
  "change_directory",
  "get_folder_capacity",
  "get_folder_capacity_batch",
  "get_common_offender_paths",
  "command_probe",
  "submit_cleanup_script",
] as const;

export interface AuthorizationRecord {
  toolName: string;
  args: unknown;
  allowed: boolean;
  timestamp: string;
}

/** Options for requesting a single user input (used by the CLI coordinator to prompt). */
export interface RequestInputOptions {
  message: string;
  validate?: (value: string) => true | string;
}

export interface AllowlistMiddlewareOptions {
  /** Request user input; the CLI coordinator will fulfill this via the user input queue. */
  requestUserInput: (options: RequestInputOptions) => Promise<string>;
}

export interface AllowlistMiddleware {
  registerAllowedTool(name: string): void;
  getAllowlist(): string[];
  /** Human-in-the-loop: request user allow/deny via queue; persist to state; return true if allowed. */
  requestToolAuthorization(toolName: string, args: unknown): Promise<boolean>;
  /** Filter tool names to only those on the allowlist. */
  filterToAllowlist(toolNames: string[]): string[];
}

const YN_VALIDATE = (v: string): true | string => {
  const lower = v.trim().toLowerCase();
  if (lower === "y" || lower === "n") return true;
  return "Enter y or n";
};

/** Stable string for (tool, args) so same logical args match (e.g. key order ignored). */
function canonicalizeArgs(args: unknown): string {
  if (args === null || typeof args !== "object") return String(args);
  const sorted = sortObjectKeys(args as Record<string, unknown>);
  return JSON.stringify(sorted);
}

function sortObjectKeys(obj: Record<string, unknown>): unknown {
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = obj[k];
    out[k] =
      v !== null && typeof v === "object" && !Array.isArray(v)
        ? sortObjectKeys(v as Record<string, unknown>)
        : Array.isArray(v)
          ? v.map((item) =>
              item !== null && typeof item === "object" && !Array.isArray(item)
                ? sortObjectKeys(item as Record<string, unknown>)
                : item
            )
          : v;
  }
  return out;
}

export function createAllowlistMiddleware(
  stateService: StateService,
  options: AllowlistMiddlewareOptions
): AllowlistMiddleware {
  const { requestUserInput } = options;

  /** Serialize authorization prompts so only one is shown at a time. */
  let authTail: Promise<boolean> = Promise.resolve(true);

  function getAllowlist(): string[] {
    const state = stateService.getState();
    const list = state[TOOL_ALLOWLIST_KEY];
    return Array.isArray(list) ? (list as string[]) : [];
  }

  function getAllowedArgsForTool(toolName: string): string[] {
    const state = stateService.getState();
    const map = state[TOOL_ALLOWED_ARGS_KEY];
    if (typeof map !== "object" || map === null) return [];
    const arr = (map as Record<string, string[]>)[toolName];
    return Array.isArray(arr) ? arr : [];
  }

  function migrateFromAuthorizationStatus(): void {
    const state = stateService.getState();
    const existing = state[TOOL_ALLOWED_ARGS_KEY];
    if (existing != null && typeof existing === "object") return;
    const history = state[TOOL_AUTHORIZATION_STATUS_KEY];
    if (!Array.isArray(history)) return;
    const allowedArgs: Record<string, string[]> = {};
    for (const record of history as AuthorizationRecord[]) {
      if (!record.allowed || !record.toolName) continue;
      const canonical = canonicalizeArgs(record.args);
      const list = allowedArgs[record.toolName] ?? [];
      if (!list.includes(canonical)) list.push(canonical);
      allowedArgs[record.toolName] = list;
    }
    if (Object.keys(allowedArgs).length === 0) return;
    stateService.setState((s) => {
      s[TOOL_ALLOWED_ARGS_KEY] = allowedArgs;
    });
  }

  async function runOneAuthorization(toolName: string, args: unknown): Promise<boolean> {
    const canonical = canonicalizeArgs(args);
    const argsStr = typeof args === "object" && args !== null ? JSON.stringify(args) : String(args);
    const answer = await requestUserInput({
      message: `Allow tool "${toolName}" with args: ${argsStr}? [y/n]`,
      validate: YN_VALIDATE,
    });
    const allowed = answer.trim().toLowerCase() === "y";
    const record: AuthorizationRecord = {
      toolName,
      args,
      allowed,
      timestamp: new Date().toISOString(),
    };
    stateService.setState((state) => {
      const history = Array.isArray(state[TOOL_AUTHORIZATION_STATUS_KEY])
        ? (state[TOOL_AUTHORIZATION_STATUS_KEY] as AuthorizationRecord[])
        : [];
      state[TOOL_AUTHORIZATION_STATUS_KEY] = [...history, record];
      if (allowed) {
        const map = (state[TOOL_ALLOWED_ARGS_KEY] ?? {}) as Record<string, string[]>;
        const list = map[toolName] ?? [];
        if (!list.includes(canonical)) map[toolName] = [...list, canonical];
        state[TOOL_ALLOWED_ARGS_KEY] = map;
      }
    });
    return allowed;
  }

  return {
    registerAllowedTool(name: string): void {
      const trimmed = name.trim();
      if (!trimmed) return;
      const list = getAllowlist();
      if (list.includes(trimmed)) return;
      stateService.setState((state) => {
        const arr = Array.isArray(state[TOOL_ALLOWLIST_KEY]) ? (state[TOOL_ALLOWLIST_KEY] as string[]) : [];
        state[TOOL_ALLOWLIST_KEY] = [...arr, trimmed];
      });
    },

    getAllowlist,

    async requestToolAuthorization(toolName: string, args: unknown): Promise<boolean> {
      migrateFromAuthorizationStatus();
      const canonical = canonicalizeArgs(args);
      const allowedList = getAllowedArgsForTool(toolName);
      if (allowedList.includes(canonical)) return true;

      const previous = authTail;
      const ourTurn = previous.then(() => runOneAuthorization(toolName, args));
      authTail = ourTurn;
      return ourTurn;
    },

    filterToAllowlist(toolNames: string[]): string[] {
      const allowlist = getAllowlist();
      if (allowlist.length === 0) return toolNames;
      return toolNames.filter((name) => allowlist.includes(name));
    },
  };
}
