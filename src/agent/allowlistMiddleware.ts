/**
 * Allowlist middleware: register allowed tools, persist allowlist and authorization status in state.
 * Tool authorization is human-in-the-loop: when a tool is about to run, request user input via the CLI queue; persist the decision.
 */

import type { StateService } from "@/system/stateService.js";
import { TOOL_ALLOWLIST_KEY, TOOL_AUTHORIZATION_STATUS_KEY } from "@/system/types.js";

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

  async function runOneAuthorization(toolName: string, args: unknown): Promise<boolean> {
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
