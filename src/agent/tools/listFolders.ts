/**
 * Tool: list_folders — list directory contents at the given path. Rejects system paths.
 */

import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { assertNotSystemPath } from "./systemPaths.js";

export interface ListFoldersOptions {
  defaultCwd?: string;
}

function listFolders(path: string, defaultCwd?: string): string {
  const toResolve = path.trim() || defaultCwd || process.cwd();
  const err = assertNotSystemPath(toResolve);
  if (err) return err;
  try {
    const dir = resolve(toResolve);
    const entries = readdirSync(dir, { withFileTypes: true });
    const lines = entries.map((e) => {
      const kind = e.isDirectory() ? "dir" : e.isFile() ? "file" : "other";
      return `${e.name}\t${kind}`;
    });
    return lines.length ? lines.join("\n") : "(empty)";
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return `Error: ${message}`;
  }
}

export function createListFoldersTool(options: ListFoldersOptions = {}) {
  const { defaultCwd } = options;
  return tool(
    ((input: { path?: string }) => listFolders(input.path ?? "", defaultCwd)) as (input: unknown) => string,
    {
      name: "list_folders",
      description: "List the contents of a directory. Give an absolute or relative path; if omitted, uses current working directory. Returns each entry with its type (dir, file, other). Never use system folders (e.g. /System, /usr, C:\\Windows).",
      schema: z.object({
        path: z.string().optional().describe("Directory path to list; default is current working directory."),
      }),
    }
  );
}
