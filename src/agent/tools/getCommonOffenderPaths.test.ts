import { describe, it, expect } from "vitest";
import { getCommonOffenderPathsTool } from "./getCommonOffenderPaths.js";
import { getCommonOffenderPaths, type PlatformName } from "./commonOffenders.js";

describe("getCommonOffenderPathsTool", () => {
  it("has correct name and description", () => {
    expect(getCommonOffenderPathsTool.name).toBe("get_common_offender_paths");
    expect(getCommonOffenderPathsTool.description).toContain("offender");
    expect(getCommonOffenderPathsTool.description).toContain("quick wins");
  });

  it("returns JSON array of path entries for current platform", async () => {
    const out = await getCommonOffenderPathsTool.invoke({});
    const parsed = JSON.parse(out as string) as Array<{ path: string; label?: string }>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    for (const entry of parsed) {
      expect(entry).toHaveProperty("path");
      expect(typeof entry.path).toBe("string");
      expect(entry.path.length).toBeGreaterThan(0);
    }
  });
});

describe("getCommonOffenderPaths (data)", () => {
  it("returns non-empty array for each platform", () => {
    for (const platform of ["mac", "windows", "linux"] as PlatformName[]) {
      const entries = getCommonOffenderPaths(platform);
      expect(entries.length).toBeGreaterThan(0);
    }
  });

  it("entries have path relative to home and no system roots", () => {
    for (const platform of ["mac", "windows", "linux"] as PlatformName[]) {
      const entries = getCommonOffenderPaths(platform);
      for (const entry of entries) {
        expect(entry.path).not.toMatch(/^\/etc\/|\/usr\/|\/System\/|\/Library\/|C:\\Windows/);
      }
    }
  });
});
