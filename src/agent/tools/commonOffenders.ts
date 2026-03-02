/**
 * Common disk-space offender paths per OS (relative to user home).
 * Used as quick-win candidates; agent must still explore the filesystem.
 */

export interface CommonOffenderEntry {
  path: string;
  label?: string;
}

export type PlatformName = "mac" | "windows" | "linux";

const OFFENDERS: Record<PlatformName, CommonOffenderEntry[]> = {
  mac: [
    { path: "Library/Caches", label: "User caches" },
    { path: ".cache", label: "User cache" },
    { path: ".npm", label: "npm cache" },
    { path: ".yarn/cache", label: "Yarn cache" },
    { path: ".pnpm-store", label: "pnpm store" },
    { path: "Library/Caches/Homebrew", label: "Homebrew cache" },
    { path: ".docker", label: "Docker data" },
    { path: ".cursor", label: "Cursor cache" },
    { path: "Library/Caches/Cursor", label: "Cursor caches" },
    { path: ".Trash", label: "Trash" },
    { path: "Library/Developer/Xcode/DerivedData", label: "Xcode derived data" },
    { path: "Library/Developer/Xcode/Archives", label: "Xcode archives" },
  ],
  linux: [
    { path: ".cache", label: "User cache" },
    { path: ".npm", label: "npm cache" },
    { path: ".yarn/cache", label: "Yarn cache" },
    { path: ".pnpm-store", label: "pnpm store" },
    { path: ".docker", label: "Docker data" },
    { path: ".cursor", label: "Cursor cache" },
    { path: ".local/share/Trash", label: "Trash" },
  ],
  windows: [
    { path: "AppData/Local/Temp", label: "Temp" },
    { path: "AppData/Local/npm-cache", label: "npm cache" },
    { path: "AppData/Local/Yarn/Cache", label: "Yarn cache" },
    { path: "AppData/Local/pnpm", label: "pnpm store" },
    { path: ".docker", label: "Docker data" },
    { path: "AppData/Local/Cursor", label: "Cursor cache" },
    { path: ".cursor", label: "Cursor cache" },
    { path: "AppData/Local/Docker", label: "Docker data" },
  ],
};

/**
 * Returns common offender path entries for the given platform.
 * Paths are relative to user home (e.g. ".cache", "Library/Caches").
 */
export function getCommonOffenderPaths(platform: PlatformName): CommonOffenderEntry[] {
  return OFFENDERS[platform] ?? [];
}
