import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StateService } from "@/system/stateService.js";
import { ConfigService } from "@/system/configService.js";
import { ProviderService } from "@/services/providerService.js";
import { createAllowlistMiddleware } from "./allowlistMiddleware.js";
import { createAgent, getExtraToolsForReport } from "./agent.js";
import { SELECTED_PROVIDER_ID_KEY } from "@/system/types.js";
import type { Provider } from "@/system/types.js";

describe("createAgent", () => {
  let stateService: StateService;
  let providerService: ProviderService;
  let allowlistMiddleware: ReturnType<typeof createAllowlistMiddleware>;

  beforeEach(() => {
    const tempDir = mkdtempSync(join(tmpdir(), "agent-"));
    const configService = new ConfigService({ appName: "test", configDir: tempDir });
    configService.loadConfig();
    configService.updateConfig((c) =>
      c.providers.push({ id: "openai-1", type: "openai", apiKey: "sk-test" })
    );
    stateService = new StateService({ appName: "test", stateDir: tempDir });
    stateService.load();
    providerService = new ProviderService(configService);
    allowlistMiddleware = createAllowlistMiddleware(stateService, {
      requestUserInput: () => Promise.resolve("y"),
    });
  });

  it("getProvider returns first provider when none selected", () => {
    const agent = createAgent({ stateService, providerService, allowlistMiddleware });
    const p = agent.getProvider();
    expect(p.id).toBe("openai-1");
    expect(p.type).toBe("openai");
  });

  it("getProvider returns selected provider when set in state", () => {
    stateService.setState((s) => {
      s[SELECTED_PROVIDER_ID_KEY] = "openai-1";
    });
    const agent = createAgent({ stateService, providerService, allowlistMiddleware });
    const p = agent.getProvider();
    expect(p.id).toBe("openai-1");
  });

  it("getProvider falls back to first when selected id not in list", () => {
    stateService.setState((s) => {
      s[SELECTED_PROVIDER_ID_KEY] = "deleted-provider";
    });
    const agent = createAgent({ stateService, providerService, allowlistMiddleware });
    const p = agent.getProvider();
    expect(p.id).toBe("openai-1");
  });

  it("getExtraToolsForReport includes web search for OpenAI provider", () => {
    const openaiProvider: Provider = { id: "o1", type: "openai", apiKey: "sk-x" };
    const accumulator = { push: () => {} };
    const extra = getExtraToolsForReport(openaiProvider, accumulator);
    expect(extra.length).toBe(2);
    const webSearchTool = extra.find((t) => (t as { type?: string }).type === "web_search");
    expect(webSearchTool).toBeDefined();
  });

  it("getExtraToolsForReport does not include web search for Anthropic provider", () => {
    const anthropicProvider: Provider = { id: "a1", type: "anthropic", apiKey: "sk-ant-x" };
    const accumulator = { push: () => {} };
    const extra = getExtraToolsForReport(anthropicProvider, accumulator);
    expect(extra.length).toBe(1);
    const webSearchTool = extra.find((t) => (t as { type?: string }).type === "web_search");
    expect(webSearchTool).toBeUndefined();
  });
});
