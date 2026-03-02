/**
 * Shared helper: recursive directory size in bytes. Used by get_folder_capacity,
 * get_folder_capacity_batch, and list_folder_contents_by_size.
 */

import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

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
