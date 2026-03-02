import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync, existsSync } from "node:fs";
import { createSubmitCleanupScriptTool } from "./submitCleanupScript.js";

describe("createSubmitCleanupScriptTool", () => {
  let scriptPath: string;

  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), "submit-script-"));
    scriptPath = join(dir, "cleanup.sh");
  });

  it("writes script content to accumulator.scriptPath and sets scriptContent", async () => {
    const accumulator = {
      scriptPath,
      scriptContent: null as string | null,
      shellType: "mac" as const,
    };
    const tool = createSubmitCleanupScriptTool(accumulator);
    const content = "#!/bin/bash\nrm -rf ~/.cache/foo\n";
    await tool.invoke({ scriptContent: content });

    expect(accumulator.scriptContent).toBe(content);
    expect(existsSync(scriptPath)).toBe(true);
    expect(readFileSync(scriptPath, "utf-8")).toBe(content);
  });

  it("returns confirmation message including path", async () => {
    const accumulator = {
      scriptPath,
      scriptContent: null as string | null,
      shellType: "linux" as const,
    };
    const tool = createSubmitCleanupScriptTool(accumulator);
    const out = await tool.invoke({ scriptContent: "echo done" });

    expect(out).toContain("Script written");
    expect(out).toContain(scriptPath);
  });
});
