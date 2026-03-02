/**
 * Platform-specific system path blocklist. Agent must never operate on these.
 */

import { platform } from "node:os";
import { resolve } from "node:path";

const SYSTEM_ROOTS: Record<string, string[]> = {
  darwin: ["/System", "/Library", "/usr", "/bin", "/sbin", "/opt"],
  win32: ["C:\\Windows", "C:\\Program Files", "C:\\Program Files (x86)", "C:\\Program Data"],
  linux: ["/etc", "/usr", "/bin", "/sbin", "/lib", "/lib64", "/boot", "/sys", "/proc", "/dev"],
};

function getSystemRoots(): string[] {
  const p = platform();
  return SYSTEM_ROOTS[p] ?? [];
}

/**
 * Resolve path to absolute and check it is not under any system root.
 * Returns null if path is allowed; returns error message if blocked.
 */
export function assertNotSystemPath(requestedPath: string): string | null {
  const roots = getSystemRoots();
  if (roots.length === 0) return null;
  let resolved: string;
  try {
    resolved = resolve(requestedPath);
  } catch {
    return "Invalid path.";
  }
  const normalized = resolved.replace(/\\/g, "/");
  for (const root of roots) {
    const rootNorm = root.replace(/\\/g, "/");
    if (normalized === rootNorm || normalized.startsWith(rootNorm + "/")) {
      return `Access to system path is not allowed: ${root}`;
    }
  }
  return null;
}

export function getPlatformName(): string {
  const p = platform();
  if (p === "darwin") return "mac";
  if (p === "win32") return "windows";
  return "linux";
}
