import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createListFoldersBatchTool } from "./listFoldersBatch.js";

describe("createListFoldersBatchTool", () => {
  it("lists multiple directories and returns JSON array", async () => {
    const dirA = mkdtempSync(join(tmpdir(), "list-folders-batch-a-"));
    const dirB = mkdtempSync(join(tmpdir(), "list-folders-batch-b-"));
    writeFileSync(join(dirA, "a.txt"), "");
    writeFileSync(join(dirB, "b.txt"), "");

    const tool = createListFoldersBatchTool({ defaultCwd: dirA });
    const out = await tool.invoke({ paths: [dirA, dirB] });
    const parsed = JSON.parse(out as string) as Array<{ path: string; output: string }>;

    expect(parsed).toHaveLength(2);
    expect(parsed[0].path).toBe(dirA);
    expect(parsed[1].path).toBe(dirB);
    expect(parsed[0].output).toContain("a.txt");
    expect(parsed[1].output).toContain("b.txt");
    expect(parsed[0].output).toMatch(/\ta\.txt|\ba\.txt\b/);
  });

  it("rejects system path on darwin", async () => {
    if (process.platform !== "darwin") return;
    const tool = createListFoldersBatchTool();
    const out = await tool.invoke({ paths: ["/System"] });
    const parsed = JSON.parse(out as string) as Array<{ output: string }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0].output).toContain("not allowed");
  });
});

