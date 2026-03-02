/**
 * Tool: list_folders_batch — list directory contents for multiple paths.
 */

import { resolve } from "node:path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { expandTilde } from "./pathUtils.js";
import { listFolders } from "./listFolders.js";

export interface ListFoldersBatchOptions {
  defaultCwd?: string;
  /** When set, tool may stream progress to the thinking display (e.g. "Listing N/M ..."). */
  onProgress?: (text: string) => void;
}

export function createListFoldersBatchTool(options: ListFoldersBatchOptions = {}) {
  const { defaultCwd, onProgress } = options;
  return tool(
    ((input: { paths: string[] }) => {
      const paths = input.paths ?? [];
      const base = defaultCwd || process.cwd();
      const results: Array<{ path: string; output: string }> = [];
      for (let i = 0; i < paths.length; i++) {
        const rawPath = paths[i] ?? "";
        const expanded = expandTilde(rawPath);
        const resolved = expanded.trim() ? resolve(base, expanded) : base;
        if (paths.length === 1) onProgress?.(`Listing ${resolved}...`);
        else onProgress?.(`Listing ${i + 1}/${paths.length}: ${resolved}...`);
        results.push({
          path: resolved,
          output: listFolders(rawPath, defaultCwd),
        });
      }
      return JSON.stringify(results, null, 0);
    }) as (input: unknown) => string,
    {
      name: "list_folders_batch",
      description:
        "List the contents of multiple directories at once. Pass an array of absolute or relative paths. Returns JSON: [{ path, output }], where output matches list_folders format (name, type, permissions). Never use system folders (e.g. /System, /usr, C:\\Windows).",
      schema: z.object({
        paths: z.array(z.string()).describe("Array of directory paths to list."),
      }),
    }
  );
}

