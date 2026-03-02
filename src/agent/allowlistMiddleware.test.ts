import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StateService } from "@/system/stateService.js";
import { createAllowlistMiddleware } from "./allowlistMiddleware.js";
import { TOOL_ALLOWLIST_KEY, TOOL_ALLOWED_ARGS_KEY } from "@/system/types.js";

const TEST_PROVIDER_ID = "test-provider";

function createMiddleware(
  stateService: StateService,
  overrides: { requestUserInput?: () => Promise<string>; getCurrentProviderId?: () => string } = {}
) {
  return createAllowlistMiddleware(stateService, {
    requestUserInput: () => Promise.resolve("y"),
    getCurrentProviderId: () => TEST_PROVIDER_ID,
    ...overrides,
  });
}

describe("AllowlistMiddleware", () => {
  let stateService: StateService;

  beforeEach(() => {
    const tempDir = mkdtempSync(join(tmpdir(), "allowlist-"));
    stateService = new StateService({ appName: "test", stateDir: tempDir });
    stateService.load();
  });

  it("getAllowlist returns empty when none registered", () => {
    const mw = createMiddleware(stateService);
    expect(mw.getAllowlist()).toEqual([]);
  });

  it("registerAllowedTool adds and persists to state (per provider)", () => {
    const mw = createMiddleware(stateService);
    mw.registerAllowedTool("scan_disk");
    expect(mw.getAllowlist()).toContain("scan_disk");
    const state = stateService.getState();
    expect(state[TOOL_ALLOWLIST_KEY]).toEqual({ [TEST_PROVIDER_ID]: ["scan_disk"] });
    mw.registerAllowedTool("delete_file");
    expect(mw.getAllowlist()).toEqual(["scan_disk", "delete_file"]);
    expect(state[TOOL_ALLOWLIST_KEY]).toEqual({ [TEST_PROVIDER_ID]: ["scan_disk", "delete_file"] });
  });

  it("filterToAllowlist returns all when allowlist empty", () => {
    const mw = createMiddleware(stateService);
    expect(mw.filterToAllowlist(["a", "b"])).toEqual(["a", "b"]);
  });

  it("filterToAllowlist filters to only allowed names", () => {
    const mw = createMiddleware(stateService);
    mw.registerAllowedTool("a");
    expect(mw.filterToAllowlist(["a", "b", "c"])).toEqual(["a"]);
  });

  it("requestToolAuthorization does not persist when user answers n and next call prompts again", async () => {
    let promptCount = 0;
    const mw = createMiddleware(stateService, {
      requestUserInput: () => {
        promptCount++;
        return Promise.resolve("n");
      },
    });
    await mw.requestToolAuthorization("denied_tool", { x: 1 });
    expect(promptCount).toBe(1);
    await mw.requestToolAuthorization("denied_tool", { x: 1 });
    expect(promptCount).toBe(2);
  });

  it("requestToolAuthorization does not prompt when same (tool, args) already allowed", async () => {
    let promptCount = 0;
    const mw = createMiddleware(stateService, {
      requestUserInput: () => {
        promptCount++;
        return Promise.resolve("y");
      },
    });
    await mw.requestToolAuthorization("list_folders", { path: "/tmp" });
    expect(promptCount).toBe(1);
    await mw.requestToolAuthorization("list_folders", { path: "/tmp" });
    expect(promptCount).toBe(1);
  });

  it("requestToolAuthorization does not prompt when args are canonically equal (key order)", async () => {
    let promptCount = 0;
    const mw = createMiddleware(stateService, {
      requestUserInput: () => {
        promptCount++;
        return Promise.resolve("y");
      },
    });
    await mw.requestToolAuthorization("change_directory", { path: "/home" });
    expect(promptCount).toBe(1);
    await mw.requestToolAuthorization("change_directory", { path: "/home" });
    expect(promptCount).toBe(1);
  });

  it("id argument is ignored so same args with different id do not prompt twice", async () => {
    let promptCount = 0;
    const mw = createMiddleware(stateService, {
      requestUserInput: () => {
        promptCount++;
        return Promise.resolve("y");
      },
    });
    await mw.requestToolAuthorization("list_folders", { path: "/tmp", id: "call-1" });
    expect(promptCount).toBe(1);
    await mw.requestToolAuthorization("list_folders", { path: "/tmp", id: "call-2" });
    expect(promptCount).toBe(1);
  });

  it("persists allowed args per provider (per-tool, per-arg arrays) so repeat call does not prompt", async () => {
    const mw = createMiddleware(stateService, { requestUserInput: () => Promise.resolve("y") });
    await mw.requestToolAuthorization("test_tool", { path: "/tmp", depth: 1 });
    const state = stateService.getState();
    const allowedArgs = state[TOOL_ALLOWED_ARGS_KEY] as Record<string, Record<string, Record<string, string[]>>>;
    expect(allowedArgs).toBeDefined();
    expect(allowedArgs[TEST_PROVIDER_ID]).toBeDefined();
    expect(allowedArgs[TEST_PROVIDER_ID]["test_tool"]).toBeDefined();
    expect(allowedArgs[TEST_PROVIDER_ID]["test_tool"]["path"]).toContain('"/tmp"');
    expect(allowedArgs[TEST_PROVIDER_ID]["test_tool"]["depth"]).toContain("1");
  });

  it("literal arg: once allowed, same value auto-allowed (no second prompt)", async () => {
    let promptCount = 0;
    const mw = createMiddleware(stateService, {
      requestUserInput: () => {
        promptCount++;
        return Promise.resolve("y");
      },
    });
    await mw.requestToolAuthorization("test_tool", { path: "/tmp" });
    expect(promptCount).toBe(1);
    await mw.requestToolAuthorization("test_tool", { path: "/tmp" });
    expect(promptCount).toBe(1);
  });

  it("array arg: once allowed, same array and subset of allowed elements auto-allowed", async () => {
    let promptCount = 0;
    const mw = createMiddleware(stateService, {
      requestUserInput: () => {
        promptCount++;
        return Promise.resolve("y");
      },
    });
    await mw.requestToolAuthorization("batch_tool", { paths: ["/tmp", "/home"] });
    expect(promptCount).toBe(1);
    await mw.requestToolAuthorization("batch_tool", { paths: ["/tmp", "/home"] });
    expect(promptCount).toBe(1);
    await mw.requestToolAuthorization("batch_tool", { paths: ["/tmp"] });
    expect(promptCount).toBe(1);
  });

  it("new literal value for same arg triggers prompt", async () => {
    let promptCount = 0;
    const mw = createMiddleware(stateService, {
      requestUserInput: () => {
        promptCount++;
        return Promise.resolve("y");
      },
    });
    await mw.requestToolAuthorization("test_tool", { path: "/tmp" });
    expect(promptCount).toBe(1);
    await mw.requestToolAuthorization("test_tool", { path: "/other" });
    expect(promptCount).toBe(2);
  });

  it("per-provider: different provider id uses different allowlist", async () => {
    let promptCount = 0;
    let currentProviderId = "provider-a";
    const mw = createAllowlistMiddleware(stateService, {
      requestUserInput: () => {
        promptCount++;
        return Promise.resolve("y");
      },
      getCurrentProviderId: () => currentProviderId,
    });
    await mw.requestToolAuthorization("list_folders", { path: "/tmp" });
    expect(promptCount).toBe(1);
    await mw.requestToolAuthorization("list_folders", { path: "/tmp" });
    expect(promptCount).toBe(1);

    currentProviderId = "provider-b";
    await mw.requestToolAuthorization("list_folders", { path: "/tmp" });
    expect(promptCount).toBe(2);

    currentProviderId = "provider-a";
    await mw.requestToolAuthorization("list_folders", { path: "/tmp" });
    expect(promptCount).toBe(2);
  });
});
