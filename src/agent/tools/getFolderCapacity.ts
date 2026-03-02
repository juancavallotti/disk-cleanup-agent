/**
 * Tool: get_folder_capacity — return size in bytes for a directory. Rejects system paths.
 */

import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { assertNotSystemPath } from "./systemPaths.js";

function getFolderCapacitySync(dirPath: string): number {
  let total = 0;
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const e of entries) {
      const full = resolve(dirPath, e.name);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          total += getFolderCapacitySync(full);
        } else {
          total += stat.size;
        }
      } catch {
        // skip inaccessible entries
      }
    }
  } catch {
    // return 0 on error
  }
  return total;
}

function getFolderCapacity(path: string, defaultCwd?: string): string {
  const base = defaultCwd || process.cwd();
  const toResolve = path.trim() ? resolve(base, path) : base;
  const err = assertNotSystemPath(toResolve);
  if (err) return err;
  try {
    const stat = statSync(toResolve);
    if (!stat.isDirectory()) return `Error: Not a directory: ${toResolve}`;
    const bytes = getFolderCapacitySync(toResolve);
    return String(bytes);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return `Error: ${message}`;
  }
}

export interface GetFolderCapacityOptions {
  defaultCwd?: string;
}

export function createGetFolderCapacityTool(options: GetFolderCapacityOptions = {}) {
  const { defaultCwd } = options;
  return tool(
    ((input: { path: string }) => getFolderCapacity(input.path, defaultCwd)) as (input: unknown) => string,
    {
      name: "get_folder_capacity",
      description: "Get the total size in bytes of a directory (recursive). Give the folder path. Can be slow for large directories. Never use system folders.",
      schema: z.object({
        path: z.string().describe("Directory path to measure."),
      }),
    }
  );
}
