/**
 * Tool: get_folder_capacity_batch — get capacity for multiple paths in parallel.
 */

import { statSync } from "node:fs";
import { resolve, basename } from "node:path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { assertNotSystemPath } from "./systemPaths.js";
import { expandTilde } from "./pathUtils.js";
import { getFolderCapacityAsync } from "./folderSize.js";

/** Truncate path for progress display so it fits ~80-char line (e.g. "Measuring 3/10: .../Cache"). */
function truncatePathForProgress(path: string, maxLen = 50): string {
  if (path.length <= maxLen) return path;
  const name = basename(path);
  const prefix = ".../";
  if (prefix.length + name.length <= maxLen) return prefix + name;
  return prefix + name.slice(-(maxLen - prefix.length));
}

async function measureOne(
  path: string,
  defaultCwd?: string
): Promise<{ path: string; sizeBytes: number; error?: string }> {
  const base = defaultCwd || process.cwd();
  const expanded = expandTilde(path);
  const toResolve = expanded.trim() ? resolve(base, expanded) : base;
  const err = assertNotSystemPath(toResolve);
  if (err) return { path: toResolve, sizeBytes: 0, error: err };
  try {
    const stat = statSync(toResolve);
    if (!stat.isDirectory()) return { path: toResolve, sizeBytes: 0, error: "Not a directory" };
    const bytes = await getFolderCapacityAsync(toResolve);
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
    (async (input: { paths: string[] }) => {
      const paths = input.paths ?? [];
      const results: { path: string; sizeBytes: number; error?: string }[] = [];
      for (let i = 0; i < paths.length; i++) {
        if (onProgress) {
          const shortPath = truncatePathForProgress(paths[i]);
          if (paths.length === 1) onProgress(`Measuring ${shortPath}...`);
          else onProgress(`Measuring ${i + 1}/${paths.length}: ${shortPath}...`);
        }
        results.push(await measureOne(paths[i], defaultCwd));
      }
      return JSON.stringify(results, null, 0);
    }) as (input: unknown) => Promise<string>,
    {
      name: "get_folder_capacity_batch",
      description: "Get the total size in bytes for multiple directories at once (runs in parallel). Pass an array of folder paths. Use this instead of calling get_folder_capacity many times to save time. Never use system folders.",
      schema: z.object({
        paths: z.array(z.string()).describe("Array of directory paths to measure."),
      }),
    }
  );
}
