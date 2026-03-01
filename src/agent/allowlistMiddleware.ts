/**
 * Allowlist middleware: register allowed tools, persist allowlist and authorization status in state.
 * Tool authorization is human-in-the-loop: when a tool is about to run, prompt the user to allow or deny; persist the decision.
 */

import input from "@inquirer/input";
import type { StateService } from "@/system/stateService.js";
import { TOOL_ALLOWLIST_KEY, TOOL_AUTHORIZATION_STATUS_KEY } from "@/system/types.js";

export interface AuthorizationRecord {
  toolName: string;
  args: unknown;
  allowed: boolean;
  timestamp: string;
}

export interface AllowlistMiddlewareOptions {
  /** Optional: custom prompt for human-in-the-loop; default prompts via inquirer. */
  promptForAuthorization?: (toolName: string, args: unknown) => Promise<boolean>;
}

export interface AllowlistMiddleware {
  registerAllowedTool(name: string): void;
  getAllowlist(): string[];
  /** Human-in-the-loop: prompt user to allow/deny tool execution; persist to state; return true if allowed. */
  requestToolAuthorization(toolName: string, args: unknown): Promise<boolean>;
  /** Filter tool names to only those on the allowlist. */
  filterToAllowlist(toolNames: string[]): string[];
}

function defaultPromptForAuthorization(toolName: string, args: unknown): Promise<boolean> {
  const argsStr = typeof args === "object" && args !== null ? JSON.stringify(args) : String(args);
  return input({
    message: `Allow tool "${toolName}" with args: ${argsStr}? [y/n]`,
    validate: (v) => {
      const lower = v.trim().toLowerCase();
      if (lower === "y" || lower === "n") return true;
      return "Enter y or n";
    },
  }).then((v) => v.trim().toLowerCase() === "y");
}

export function createAllowlistMiddleware(
  stateService: StateService,
  options: AllowlistMiddlewareOptions = {}
): AllowlistMiddleware {
  const promptForAuthorization = options.promptForAuthorization ?? defaultPromptForAuthorization;

  function getAllowlist(): string[] {
    const state = stateService.getState();
    const list = state[TOOL_ALLOWLIST_KEY];
    return Array.isArray(list) ? (list as string[]) : [];
  }

  function getAuthorizationHistory(): AuthorizationRecord[] {
    const state = stateService.getState();
    const history = state[TOOL_AUTHORIZATION_STATUS_KEY];
    return Array.isArray(history) ? (history as AuthorizationRecord[]) : [];
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
      const allowed = await promptForAuthorization(toolName, args);
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
    },

    filterToAllowlist(toolNames: string[]): string[] {
      const allowlist = getAllowlist();
      if (allowlist.length === 0) return toolNames;
      return toolNames.filter((name) => allowlist.includes(name));
    },
  };
}
