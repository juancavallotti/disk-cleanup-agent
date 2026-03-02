/**
 * Path resolution helpers. Expands ~ to user home so tool inputs like ~/Library/Caches
 * resolve correctly instead of being joined with cwd.
 */

import { homedir } from "node:os";
import { join } from "node:path";

/**
 * If the path starts with ~ (user home), replace it with the actual home directory.
 * Otherwise return the path unchanged.
 */
export function expandTilde(p: string): string {
  const t = p.trim();
  if (t === "~") return homedir();
  if (t.startsWith("~/") || t.startsWith("~\\")) return join(homedir(), t.slice(2));
  return p;
}
