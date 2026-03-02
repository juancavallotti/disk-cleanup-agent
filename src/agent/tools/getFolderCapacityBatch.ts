/**
 * Tool: get_folder_capacity_batch — get capacity for multiple paths in parallel.
 */

import { statSync } from "node:fs";
import { resolve } from "node:path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { assertNotSystemPath } from "./systemPaths.js";
import { getFolderCapacitySync } from "./folderSize.js";

function measureOne(path: string, defaultCwd?: string): { path: string; sizeBytes: number; error?: string } {
  const base = defaultCwd || process.cwd();
  const toResolve = path.trim() ? resolve(base, path) : base;
  const err = assertNotSystemPath(toResolve);
  if (err) return { path: toResolve, sizeBytes: 0, error: err };
  try {
    const stat = statSync(toResolve);
    if (!stat.isDirectory()) return { path: toResolve, sizeBytes: 0, error: "Not a directory" };
    const bytes = getFolderCapacitySync(toResolve);
    return { path: toResolve, sizeBytes: bytes };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { path: toResolve, sizeBytes: 0, error: message };
  }
}

export interface GetFolderCapacityBatchOptions {
  defaultCwd?: string;
  /** When set, tool may stream progress to the thinking display (e.g. "Measuring N paths..."). */
  onProgress?: (text: string) => void;
}

export function createGetFolderCapacityBatchTool(options: GetFolderCapacityBatchOptions = {}) {
  const { defaultCwd, onProgress } = options;
  return tool(
    ((input: { paths: string[] }) => {
      const paths = input.paths ?? [];
      const results: { path: string; sizeBytes: number; error?: string }[] = [];
      for (let i = 0; i < paths.length; i++) {
        if (onProgress) {
          if (paths.length === 1) onProgress(`Measuring ${paths[i]}...`);
          else onProgress(`Measuring ${i + 1}/${paths.length}: ${paths[i]}...`);
        }
        results.push(measureOne(paths[i], defaultCwd));
      }
      return JSON.stringify(results, null, 0);
    }) as (input: unknown) => string,
    {
      name: "get_folder_capacity_batch",
      description: "Get the total size in bytes for multiple directories at once (runs in parallel). Pass an array of folder paths. Use this instead of calling get_folder_capacity many times to save time. Never use system folders.",
      schema: z.object({
        paths: z.array(z.string()).describe("Array of directory paths to measure."),
      }),
    }
  );
}
