import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigService } from "@/system/configService.js";
import { ProviderService } from "./providerService.js";

describe("ProviderService", () => {
  let configService: ConfigService;

  beforeEach(() => {
    const tempDir = mkdtempSync(join(tmpdir(), "disk-cleanup-provider-"));
    configService = new ConfigService({ appName: "test", configDir: tempDir });
    configService.loadConfig();
  });

  it("listProviders returns empty when none configured", () => {
    const service = new ProviderService(configService);
    expect(service.listProviders()).toEqual([]);
  });

  it("addProvider adds and listProviders returns it", () => {
    const service = new ProviderService(configService);
    service.addProvider({ type: "openai", apiKey: "sk-test" });
    const list = service.listProviders();
    expect(list).toHaveLength(1);
    expect(list[0].type).toBe("openai");
    expect(list[0].apiKey).toBe("sk-test");
    expect(list[0].id).toMatch(/^openai-\d+$/);
  });

  it("deleteProvider removes by id", () => {
    const service = new ProviderService(configService);
    service.addProvider({ type: "anthropic", id: "my-ant", apiKey: "sk-ant" });
    expect(service.listProviders()).toHaveLength(1);
    service.deleteProvider("my-ant");
    expect(service.listProviders()).toEqual([]);
  });

  it("addProvider throws for invalid type", () => {
    const service = new ProviderService(configService);
    expect(() =>
      service.addProvider({ type: "invalid" as "openai", apiKey: "x" })
    ).toThrow("Invalid provider type");
  });

  it("addProvider throws for empty apiKey", () => {
    const service = new ProviderService(configService);
    expect(() => service.addProvider({ type: "openai", apiKey: "   " })).toThrow("API key is required");
  });
});
