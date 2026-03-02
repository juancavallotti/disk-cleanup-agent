/**
 * Tool: list_folders — list directory contents at the given path. Rejects system paths.
 */

import { accessSync, constants, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { assertNotSystemPath } from "./systemPaths.js";
import { expandTilde } from "./pathUtils.js";

export interface ListFoldersOptions {
  defaultCwd?: string;
  /** When set, tool may stream progress to the thinking display (e.g. "Listing ..."). */
  onProgress?: (text: string) => void;
}

function getPermissions(targetPath: string): string {
  let canRead = false;
  let canWrite = false;
  try {
    accessSync(targetPath, constants.R_OK);
    canRead = true;
  } catch {}
  try {
    accessSync(targetPath, constants.W_OK);
    canWrite = true;
  } catch {}
  return `${canRead ? "r" : "-"}${canWrite ? "w" : "-"}`;
}

export function listFolders(path: string, defaultCwd?: string): string {
  const base = defaultCwd || process.cwd();
  const expanded = expandTilde(path);
  const toResolve = expanded.trim() ? resolve(base, expanded) : base;
  const err = assertNotSystemPath(toResolve);
  if (err) return err;
  try {
    const dir = resolve(toResolve);
    const entries = readdirSync(dir, { withFileTypes: true });
    const lines = entries.map((e) => {
      const kind = e.isDirectory() ? "dir" : e.isFile() ? "file" : "other";
      const perms = getPermissions(join(dir, e.name));
      return `${e.name}\t${kind}\t${perms}`;
    });
    return lines.length ? lines.join("\n") : "(empty)";
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return `Error: ${message}`;
  }
}

export function createListFoldersTool(options: ListFoldersOptions = {}) {
  const { defaultCwd, onProgress } = options;
  return tool(
    ((input: { path?: string }) => {
      const path = input.path ?? "";
      const base = defaultCwd || process.cwd();
      const expanded = expandTilde(path);
      const toResolve = expanded.trim() ? resolve(base, expanded) : base;
      onProgress?.(`Listing ${toResolve || "."}...`);
      return listFolders(path, defaultCwd);
    }) as (input: unknown) => string,
    {
      name: "list_folders",
      description: "List the contents of a directory. Give an absolute or relative path; if omitted, uses current working directory. Returns each entry with its type (dir, file, other) and permissions (rw, r-, -w, --). Never use system folders (e.g. /System, /usr, C:\\Windows).",
      schema: z.object({
        path: z.string().optional().describe("Directory path to list; default is current working directory."),
      }),
    }
  );
}
