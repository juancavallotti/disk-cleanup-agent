/**
 * Wraps a tool so that before execution we call allowlistMiddleware.requestToolAuthorization.
 */

import type { StructuredToolInterface } from "@langchain/core/tools";
import type { AllowlistMiddleware } from "@/agent/allowlistMiddleware.js";

const ALLOWLISTED_TOOL_NAMES = ["list_folders", "change_directory", "get_folder_capacity", "get_folder_capacity_batch"];

export function wrapToolWithAllowlist(
  tool: StructuredToolInterface,
  allowlistMiddleware: AllowlistMiddleware
): StructuredToolInterface {
  if (!ALLOWLISTED_TOOL_NAMES.includes(tool.name)) {
    return tool;
  }
  const originalInvoke = tool.invoke.bind(tool);
  return {
    ...tool,
    async invoke(arg: unknown, options?: unknown): Promise<unknown> {
      const allowed = await allowlistMiddleware.requestToolAuthorization(tool.name, arg);
      if (!allowed) {
        return "Tool execution denied by user.";
      }
      return originalInvoke(arg, options as Parameters<typeof originalInvoke>[1]);
    },
  } as StructuredToolInterface;
}
