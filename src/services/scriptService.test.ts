import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync, existsSync } from "node:fs";
import { ConfigService } from "@/system/configService.js";
import { ScriptService } from "./scriptService.js";

describe("ScriptService", () => {
  let configService: ConfigService;
  let scriptService: ScriptService;

  beforeEach(() => {
    const tempDir = mkdtempSync(join(tmpdir(), "script-service-"));
    configService = new ConfigService({ appName: "test", configDir: tempDir });
    scriptService = new ScriptService({ configService });
  });

  it("getNextScriptPath returns path with .sh extension for script dir", () => {
    const path = scriptService.getNextScriptPath(".sh");
    expect(path).toContain("scripts");
    expect(path.endsWith(".sh")).toBe(true);
    expect(path).toMatch(/cleanup-\d{4}-\d{2}-\d{2}/);
  });

  it("getNextScriptPath returns path with .ps1 extension", () => {
    const path = scriptService.getNextScriptPath(".ps1");
    expect(path).toContain("scripts");
    expect(path.endsWith(".ps1")).toBe(true);
  });

  it("writeScript creates file with content", () => {
    const path = scriptService.getNextScriptPath(".sh");
    const content = "#!/bin/bash\necho hello\n";
    scriptService.writeScript(path, content);

    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf-8")).toBe(content);
  });
});
