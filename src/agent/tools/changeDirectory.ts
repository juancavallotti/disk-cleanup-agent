/**
 * Tool: change_directory — validate and return the new path (agent tracks cwd).
 * Rejects system paths.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { assertNotSystemPath } from "./systemPaths.js";
import { expandTilde } from "./pathUtils.js";

export interface ChangeDirectoryOptions {
  defaultCwd?: string;
}

function changeDirectory(path: string, defaultCwd?: string): string {
  const base = defaultCwd || process.cwd();
  const expanded = expandTilde(path);
  const toResolve = expanded.trim() ? resolve(base, expanded) : base;
  const err = assertNotSystemPath(toResolve);
  if (err) return err;
  try {
    if (!existsSync(toResolve)) return `Error: Path does not exist: ${toResolve}`;
    return `OK. New path: ${toResolve}`;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return `Error: ${message}`;
  }
}

export function createChangeDirectoryTool(options: ChangeDirectoryOptions = {}) {
  const { defaultCwd } = options;
  return tool(
    ((input: { path: string }) => changeDirectory(input.path, defaultCwd)) as (input: unknown) => string,
    {
      name: "change_directory",
      description: "Change current working directory to the given path (absolute or relative). Returns the new absolute path on success. Never use system folders.",
      schema: z.object({
        path: z.string().describe("Target directory path (absolute or relative)."),
      }),
    }
  );
}
