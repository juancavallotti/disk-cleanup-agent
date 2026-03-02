import { describe, it, expect } from "vitest";
import { getPlatformName, assertNotSystemPath } from "./systemPaths.js";

describe("systemPaths", () => {
  describe("getPlatformName", () => {
    it("returns mac, windows, or linux", () => {
      const name = getPlatformName();
      expect(["mac", "windows", "linux"]).toContain(name);
    });
  });

  describe("assertNotSystemPath", () => {
    it("returns null for user home path", () => {
      const home = process.env.HOME || process.env.USERPROFILE || "/tmp";
      expect(assertNotSystemPath(home)).toBeNull();
    });

    it("returns error for system path on darwin", () => {
      if (process.platform !== "darwin") return;
      expect(assertNotSystemPath("/System/Library")).not.toBeNull();
      expect(assertNotSystemPath("/usr/bin")).not.toBeNull();
    });

    it("returns error for system path on linux", () => {
      if (process.platform !== "linux") return;
      expect(assertNotSystemPath("/etc")).not.toBeNull();
      expect(assertNotSystemPath("/usr")).not.toBeNull();
    });
  });
});
