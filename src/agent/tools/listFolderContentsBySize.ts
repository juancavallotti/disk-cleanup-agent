/**
 * Tool: list_folder_contents_by_size — list direct contents of a folder as a markdown table
 * (path, fileSize, kind), sorted by size descending. Rejects system paths.
 */

import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { assertNotSystemPath } from "./systemPaths.js";
import { getFolderCapacitySync } from "./folderSize.js";

export interface ListFolderContentsBySizeOptions {
  defaultCwd?: string;
  /** When set, tool may stream progress to the thinking display. */
  onProgress?: (text: string) => void;
}

interface Row {
  path: string;
  fileSize: number;
  kind: string;
}

function listFolderContentsBySize(path: string, defaultCwd?: string): string {
  const base = defaultCwd || process.cwd();
  const toResolve = path.trim() ? resolve(base, path) : base;
  const err = assertNotSystemPath(toResolve);
  if (err) return err;
  try {
    const stat = statSync(toResolve);
    if (!stat.isDirectory()) return `Error: Not a directory: ${toResolve}`;

    const entries = readdirSync(toResolve, { withFileTypes: true });
    const rows: Row[] = [];

    for (const e of entries) {
      const fullPath = resolve(toResolve, e.name);
      try {
        const entryStat = statSync(fullPath);
        const kind = e.isDirectory() ? "dir" : e.isFile() ? "file" : "other";
        const fileSize = entryStat.isDirectory() ? getFolderCapacitySync(fullPath) : entryStat.size;
        rows.push({ path: fullPath, fileSize, kind });
      } catch {
        // skip inaccessible entries
      }
    }

    rows.sort((a, b) => b.fileSize - a.fileSize);

    const header = "| path | fileSize | kind |";
    const separator = "|------|----------|------|";
    const body = rows.map((r) => `| ${r.path} | ${r.fileSize} | ${r.kind} |`).join("\n");
    return rows.length ? `${header}\n${separator}\n${body}` : `${header}\n${separator}\n(empty)`;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return `Error: ${message}`;
  }
}

export function createListFolderContentsBySizeTool(options: ListFolderContentsBySizeOptions = {}) {
  const { defaultCwd, onProgress } = options;
  return tool(
    ((input: { path?: string }) => {
      const path = input.path ?? "";
      const base = defaultCwd || process.cwd();
      const toResolve = path.trim() ? resolve(base, path) : base;
      onProgress?.(`Listing contents by size for ${toResolve || "."}...`);
      return listFolderContentsBySize(path, defaultCwd);
    }) as (input: unknown) => string,
    {
      name: "list_folder_contents_by_size",
      description:
        "List the direct contents of a directory (one level only) as a markdown table: path, fileSize, kind. Sorted by fileSize descending. Use this to see which specific files or subfolders inside a directory are large, so you can report individual items via report_cleanup_opportunity. Never use system folders.",
      schema: z.object({
        path: z.string().optional().describe("Directory path; default is current working directory."),
      }),
    }
  );
}
