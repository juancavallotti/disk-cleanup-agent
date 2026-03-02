import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import select from "@inquirer/select";
import { ConfigService } from "@/system/configService.js";
import { StateService } from "@/system/stateService.js";
import { ProviderService } from "@/services/providerService.js";
import { handleDeleteProvider } from "./deleteProvider.js";
import type { BootstrapContext } from "@/system/bootstrap.js";
import { SELECTED_PROVIDER_ID_KEY } from "@/system/types.js";

vi.mock("@inquirer/select", () => ({
  default: vi.fn(),
}));

describe("handleDeleteProvider", () => {
  let configService: ConfigService;
  let stateService: StateService;
  let providerService: ProviderService;
  let recreateAgent: ReturnType<typeof vi.fn>;
  let context: BootstrapContext;

  beforeEach(() => {
    const tempDir = mkdtempSync(join(tmpdir(), "delete-provider-"));
    configService = new ConfigService({ appName: "test", configDir: tempDir });
    configService.loadConfig();
    stateService = new StateService({ appName: "test", stateDir: tempDir });
    stateService.load();
    providerService = new ProviderService(configService);
    providerService.addProvider({ type: "openai", id: "openai-1", apiKey: "sk-test" });
    recreateAgent = vi.fn();
    context = {
      configService,
      stateService,
      providerService,
      agent: {} as BootstrapContext["agent"],
      recreateAgent,
      userInputQueue: {} as BootstrapContext["userInputQueue"],
    };
  });

  it("with id provided, deletes provider", async () => {
    await handleDeleteProvider(context, "openai-1");
    expect(providerService.listProviders()).toHaveLength(0);
  });

  it("with id provided and deleted was selected, clears state and calls recreateAgent", async () => {
    stateService.setState((s) => {
      s[SELECTED_PROVIDER_ID_KEY] = "openai-1";
    });
    await handleDeleteProvider(context, "openai-1");
    expect(providerService.listProviders()).toHaveLength(0);
    expect(stateService.getState()[SELECTED_PROVIDER_ID_KEY]).toBeUndefined();
    expect(recreateAgent).toHaveBeenCalledTimes(1);
  });

  it("with empty id, runs interactive select and deletes chosen provider", async () => {
    vi.mocked(select).mockResolvedValueOnce("openai-1");
    await handleDeleteProvider(context, "");
    expect(providerService.listProviders()).toHaveLength(0);
  });

  it("with empty id and cancel, does not delete", async () => {
    vi.mocked(select).mockResolvedValueOnce("__cancel__");
    await handleDeleteProvider(context, "");
    expect(providerService.listProviders()).toHaveLength(1);
  });
});
