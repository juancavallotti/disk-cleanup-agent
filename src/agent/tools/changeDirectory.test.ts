import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createChangeDirectoryTool } from "./changeDirectory.js";

describe("createChangeDirectoryTool", () => {
  it("returns OK and new path for existing directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "change-dir-"));
    const tool = createChangeDirectoryTool({ defaultCwd: tmpdir() });
    const out = await tool.invoke({ path: dir });
    expect(out).toContain("OK");
    expect(out).toContain(dir);
  });

  it("returns error for non-existent path", async () => {
    const tool = createChangeDirectoryTool({ defaultCwd: tmpdir() });
    const out = await tool.invoke({ path: "/nonexistent-path-xyz-123" });
    expect(out).toContain("Error");
    expect(out).toContain("exist");
  });
});
