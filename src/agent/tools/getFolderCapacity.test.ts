import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createGetFolderCapacityTool } from "./getFolderCapacity.js";

describe("createGetFolderCapacityTool", () => {
  it("returns size in bytes for directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "capacity-"));
    writeFileSync(join(dir, "f.txt"), "hello");
    const tool = createGetFolderCapacityTool({ defaultCwd: dir });
    const out = await tool.invoke({ path: dir });
    expect(Number(out)).toBeGreaterThanOrEqual(5);
  });

  it("returns error for non-directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "capacity-"));
    const file = join(dir, "f.txt");
    writeFileSync(file, "x");
    const tool = createGetFolderCapacityTool({ defaultCwd: dir });
    const out = await tool.invoke({ path: file });
    expect(out).toContain("Error");
    expect(out).toContain("Not a directory");
  });
});
