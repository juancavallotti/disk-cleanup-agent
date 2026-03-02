/**
 * Tool: get_folder_capacity — return size in bytes for a directory. Rejects system paths.
 */

import { statSync } from "node:fs";
import { resolve } from "node:path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { assertNotSystemPath } from "./systemPaths.js";
import { expandTilde } from "./pathUtils.js";
import { getFolderCapacityAsync } from "./folderSize.js";

async function getFolderCapacity(path: string, defaultCwd?: string): Promise<string> {
  const base = defaultCwd || process.cwd();
  const expanded = expandTilde(path);
  const toResolve = expanded.trim() ? resolve(base, expanded) : base;
  const err = assertNotSystemPath(toResolve);
  if (err) return err;
  try {
    const stat = statSync(toResolve);
    if (!stat.isDirectory()) return `Error: Not a directory: ${toResolve}`;
    const bytes = await getFolderCapacityAsync(toResolve);
    return String(bytes);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return `Error: ${message}`;
  }
}

export interface GetFolderCapacityOptions {
  defaultCwd?: string;
  /** When set, tool may stream progress to the thinking display (e.g. "Measuring ..."). */
  onProgress?: (text: string) => void;
}

export function createGetFolderCapacityTool(options: GetFolderCapacityOptions = {}) {
  const { defaultCwd, onProgress } = options;
  return tool(
    (async (input: { path: string }) => {
      onProgress?.(`Measuring ${input.path || "."}...`);
      return getFolderCapacity(input.path, defaultCwd);
    }) as (input: unknown) => Promise<string>,
    {
      name: "get_folder_capacity",
      description: "Get the total size in bytes of a directory (recursive). Give the folder path. Can be slow for large directories. Never use system folders.",
      schema: z.object({
        path: z.string().describe("Directory path to measure."),
      }),
    }
  );
}
