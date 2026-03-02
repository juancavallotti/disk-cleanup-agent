import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createListFolderContentsBySizeTool } from "./listFolderContentsBySize.js";

describe("createListFolderContentsBySizeTool", () => {
  it("lists direct contents with path, fileSize, kind; sorted by size descending; output is markdown table", async () => {
    const dir = mkdtempSync(join(tmpdir(), "list-by-size-"));
    writeFileSync(join(dir, "small.txt"), "a");
    writeFileSync(join(dir, "large.txt"), "x".repeat(200));
    const subDir = join(dir, "sub");
    mkdirSync(subDir);
    writeFileSync(join(subDir, "nested"), "n");

    const tool = createListFolderContentsBySizeTool({ defaultCwd: dir });
    const out = await tool.invoke({ path: dir });

    expect(out).toContain("| path | fileSize | kind |");
    expect(out).toContain("|------|----------|------|");
    expect(out).toContain("large.txt");
    expect(out).toContain("small.txt");
    expect(out).toContain("sub");
    expect(out).toContain("file");
    expect(out).toContain("dir");
    // sub (dir) has at least nested file size; large.txt (200) > small.txt (1); order by size desc
    const largeIdx = out.indexOf("large.txt");
    const smallIdx = out.indexOf("small.txt");
    expect(largeIdx).toBeLessThan(smallIdx);
  });

  it("rejects system path on darwin", async () => {
    if (process.platform !== "darwin") return;
    const tool = createListFolderContentsBySizeTool();
    const out = await tool.invoke({ path: "/System" });
    expect(out).toContain("not allowed");
  });

  it("returns table with empty message for empty folder", async () => {
    const dir = mkdtempSync(join(tmpdir(), "list-by-size-empty-"));
    const tool = createListFolderContentsBySizeTool({ defaultCwd: dir });
    const out = await tool.invoke({ path: dir });
    expect(out).toContain("| path | fileSize | kind |");
    expect(out).toContain("(empty)");
  });
});
