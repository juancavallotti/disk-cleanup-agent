/**
 * Allowlist middleware: register allowed tools, persist per-tool allowed-args in state.
 * Tool authorization is human-in-the-loop: prompt only when (tool, args) is new; once allowed, same args are auto-allowed.
 * State is keyed by provider id (one allowlist per model provider). The `id` tool argument is ignored.
 */

import type { StateService } from "@/system/stateService.js";
import { TOOL_ALLOWLIST_KEY, TOOL_ALLOWED_ARGS_KEY } from "@/system/types.js";

/** Single source of truth for which tools participate in allowlist behavior. Skills (get_skill) are always allowed and not listed here. */
export const ALLOWLIST_TOOL_NAMES = [
  "list_folders",
  "list_folder_contents_by_size",
  "change_directory",
  "get_folder_capacity",
  "get_folder_capacity_batch",
  "get_common_offender_paths",
  "command_probe",
  "submit_cleanup_script",
] as const;

/** Options for requesting a single user input (used by the CLI coordinator to prompt). */
export interface RequestInputOptions {
  message: string;
  validate?: (value: string) => true | string;
}

export interface AllowlistMiddlewareOptions {
  /** Request user input; the CLI coordinator will fulfill this via the user input queue. */
  requestUserInput: (options: RequestInputOptions) => Promise<string>;
  /** Resolve the current model provider id so allowlist state is scoped per provider. */
  getCurrentProviderId: () => string;
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

/** Strip `id` from args (unique per execution; not used for allowlist). */
function argsWithoutId(args: unknown): Record<string, unknown> {
  if (args === null || typeof args !== "object" || Array.isArray(args)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (k !== "id") out[k] = v;
  }
  return out;
}

/** Canonical string for a single value (primitive or object) for comparison and storage. */
function canonicalizeValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => canonicalizeValue(item)));
  const sorted = sortObjectKeys(value as Record<string, unknown>);
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

/** Per-provider allowlist: Record<providerId, string[]>. Invalid or old shape → empty. */
function getAllowlistByProvider(state: Record<string, unknown>, providerId: string): string[] {
  const root = state[TOOL_ALLOWLIST_KEY];
  if (typeof root !== "object" || root === null) return [];
  const perProvider = root as Record<string, unknown>;
  const list = perProvider[providerId];
  return Array.isArray(list) ? (list as string[]) : [];
}

/** Per-provider allowed args: Record<providerId, Record<toolName, Record<argName, string[]>>>. Invalid or old shape → empty. */
function getAllowedArgsByProvider(
  state: Record<string, unknown>,
  providerId: string
): Record<string, Record<string, string[]>> {
  const root = state[TOOL_ALLOWED_ARGS_KEY];
  if (typeof root !== "object" || root === null) return {};
  const perProvider = root as Record<string, unknown>;
  const perTool = perProvider[providerId];
  if (typeof perTool !== "object" || perTool === null) return {};
  const toolMap = perTool as Record<string, unknown>;
  const result: Record<string, Record<string, string[]>> = {};
  for (const [toolName, argMap] of Object.entries(toolMap)) {
    if (typeof argMap !== "object" || argMap === null) continue;
    const argRecord = argMap as Record<string, unknown>;
    const arrMap: Record<string, string[]> = {};
    for (const [argName, arr] of Object.entries(argRecord)) {
      if (Array.isArray(arr)) {
        const strings = arr.filter((x): x is string => typeof x === "string");
        arrMap[argName] = strings;
      }
    }
    if (Object.keys(arrMap).length > 0) result[toolName] = arrMap;
  }
  return result;
}

/** Check if a single arg value is allowed: literal → one entry in set; array → every element in set. */
function isArgValueAllowed(value: unknown, allowedSet: Set<string>): boolean {
  if (Array.isArray(value)) {
    return value.every((elem) => allowedSet.has(canonicalizeValue(elem)));
  }
  return allowedSet.has(canonicalizeValue(value));
}

/** Collect values to add for one arg: literal → [canonical]; array → each element canonicalized. */
function valuesToAdd(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((elem) => canonicalizeValue(elem));
  }
  return [canonicalizeValue(value)];
}

export function createAllowlistMiddleware(
  stateService: StateService,
  options: AllowlistMiddlewareOptions
): AllowlistMiddleware {
  const { requestUserInput, getCurrentProviderId } = options;

  /** Serialize authorization prompts so only one is shown at a time. */
  let authTail: Promise<boolean> = Promise.resolve(true);

  function getAllowlist(): string[] {
    const providerId = getCurrentProviderId();
    if (!providerId) return [];
    const state = stateService.getState();
    return getAllowlistByProvider(state, providerId);
  }

  function getAllowedArgsForTool(toolName: string): Record<string, string[]> {
    const providerId = getCurrentProviderId();
    if (!providerId) return {};
    const state = stateService.getState();
    const perTool = getAllowedArgsByProvider(state, providerId);
    return perTool[toolName] ?? {};
  }

  async function runOneAuthorization(toolName: string, args: unknown): Promise<boolean> {
    const argsStr = typeof args === "object" && args !== null ? JSON.stringify(args) : String(args);
    const answer = await requestUserInput({
      message: `Allow tool "${toolName}" with args: ${argsStr}? [y/n]`,
      validate: YN_VALIDATE,
    });
    const allowed = answer.trim().toLowerCase() === "y";
    if (!allowed) return false;

    const providerId = getCurrentProviderId();
    if (!providerId) return true;

    const filtered = argsWithoutId(args);
    stateService.setState((state) => {
      const rootAllowlist = (state[TOOL_ALLOWLIST_KEY] ?? {}) as Record<string, unknown>;
      let list = getAllowlistByProvider(state, providerId);
      if (!list.includes(toolName)) {
        list = [...list, toolName];
        rootAllowlist[providerId] = list;
        state[TOOL_ALLOWLIST_KEY] = rootAllowlist;
      }

      const rootArgs = (state[TOOL_ALLOWED_ARGS_KEY] ?? {}) as Record<string, unknown>;
      const perProvider = (rootArgs[providerId] ?? {}) as Record<string, unknown>;
      const perTool = (perProvider[toolName] ?? {}) as Record<string, string[]>;

      for (const [argName, value] of Object.entries(filtered)) {
        const toAdd = valuesToAdd(value);
        const existing = perTool[argName] ?? [];
        const set = new Set(existing);
        for (const c of toAdd) set.add(c);
        perTool[argName] = [...set];
      }
      perProvider[toolName] = perTool;
      rootArgs[providerId] = perProvider;
      state[TOOL_ALLOWED_ARGS_KEY] = rootArgs;
    });
    return true;
  }

  /** True if (tool, args without id) is already allowed for current provider. */
  function isAlreadyAllowed(toolName: string, args: unknown): boolean {
    const providerId = getCurrentProviderId();
    if (!providerId) return false;

    const allowlist = getAllowlist();
    if (!allowlist.includes(toolName)) return false;

    const filtered = argsWithoutId(args);
    const allowedPerArg = getAllowedArgsForTool(toolName);

    for (const [argName, value] of Object.entries(filtered)) {
      const allowedList = allowedPerArg[argName];
      if (!Array.isArray(allowedList)) return false;
      const set = new Set(allowedList);
      if (!isArgValueAllowed(value, set)) return false;
    }

    const allowedKeys = new Set(Object.keys(allowedPerArg));
    const incomingKeys = new Set(Object.keys(filtered));
    if (incomingKeys.size > 0 && allowedKeys.size === 0) return false;
    for (const k of incomingKeys) {
      if (!allowedKeys.has(k)) return false;
    }
    return true;
  }

  return {
    registerAllowedTool(name: string): void {
      const trimmed = name.trim();
      if (!trimmed) return;
      const providerId = getCurrentProviderId();
      if (!providerId) return;
      const list = getAllowlist();
      if (list.includes(trimmed)) return;
      stateService.setState((state) => {
        const root = (state[TOOL_ALLOWLIST_KEY] ?? {}) as Record<string, unknown>;
        const providerList = getAllowlistByProvider(state, providerId);
        root[providerId] = [...providerList, trimmed];
        state[TOOL_ALLOWLIST_KEY] = root;
      });
    },

    getAllowlist,

    async requestToolAuthorization(toolName: string, args: unknown): Promise<boolean> {
      if (isAlreadyAllowed(toolName, args)) return true;

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
