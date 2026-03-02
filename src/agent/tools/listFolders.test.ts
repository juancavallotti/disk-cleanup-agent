import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createListFoldersTool } from "./listFolders.js";

describe("createListFoldersTool", () => {
  it("lists directory contents", async () => {
    const dir = mkdtempSync(join(tmpdir(), "list-folders-"));
    writeFileSync(join(dir, "a.txt"), "");
    const tool = createListFoldersTool({ defaultCwd: dir });
    const out = await tool.invoke({ path: dir });
    expect(out).toContain("a.txt");
    expect(out).toContain("file");
  });

  it("rejects system path on darwin", async () => {
    if (process.platform !== "darwin") return;
    const tool = createListFoldersTool();
    const out = await tool.invoke({ path: "/System" });
    expect(out).toContain("not allowed");
  });
});
