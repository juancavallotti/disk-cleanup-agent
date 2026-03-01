import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigService } from "./configService.js";

describe("ConfigService", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "disk-cleanup-config-"));
  });

  it("creates default config when file does not exist", () => {
    const service = new ConfigService({ appName: "test", configDir: tempDir });
    const config = service.loadConfig();
    expect(config.providers).toEqual([]);
    expect(existsSync(join(tempDir, "config.yaml"))).toBe(true);
  });

  it("loads existing config from disk", () => {
    const service = new ConfigService({ appName: "test", configDir: tempDir });
    service.loadConfig();
    service.updateConfig((c) => c.providers.push({ id: "p1", type: "openai", apiKey: "sk-x" }));
    const service2 = new ConfigService({ appName: "test", configDir: tempDir });
    const config = service2.loadConfig();
    expect(config.providers).toHaveLength(1);
    expect(config.providers[0]).toEqual({ id: "p1", type: "openai", apiKey: "sk-x" });
  });

  it("updateConfig persists changes", () => {
    const service = new ConfigService({ appName: "test", configDir: tempDir });
    service.loadConfig();
    service.updateConfig((c) => c.providers.push({ id: "p2", type: "anthropic", apiKey: "sk-y" }));
    const raw = readFileSync(join(tempDir, "config.yaml"), "utf-8");
    expect(raw).toContain("p2");
    expect(raw).toContain("anthropic");
  });
});
