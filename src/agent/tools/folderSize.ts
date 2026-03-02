/**
 * Shared helper: recursive directory size in bytes. Used by get_folder_capacity,
 * get_folder_capacity_batch, and list_folder_contents_by_size.
 * Async version uses `du` subprocess on Unix so the event loop can run (e.g. stream UX).
 */

import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { platform } from "node:os";
import { spawn } from "node:child_process";

export function getFolderCapacitySync(dirPath: string): number {
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

/**
 * Async directory size in bytes. On Unix uses `du` subprocess so the main thread
 * is not blocked and the stream/UX can update. On Windows falls back to sync.
 */
export function getFolderCapacityAsync(dirPath: string): Promise<number> {
  if (platform() === "win32") {
    return Promise.resolve(getFolderCapacitySync(dirPath));
  }
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("du", ["-sk", dirPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => rejectPromise(err));
    child.on("close", (code) => {
      if (code !== 0) {
        rejectPromise(new Error(stderr || `du exited ${code}`));
        return;
      }
      // du -sk outputs e.g. "12345\t/path" or "12345 /path"
      const first = stdout.split(/\s/)[0];
      const kb = parseInt(first, 10);
      if (Number.isNaN(kb)) {
        rejectPromise(new Error(`du: could not parse output: ${stdout}`));
        return;
      }
      resolvePromise(kb * 1024);
    });
  });
}
