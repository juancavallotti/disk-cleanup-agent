import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StateService } from "@/system/stateService.js";
import { createAllowlistMiddleware } from "./allowlistMiddleware.js";
import { TOOL_ALLOWLIST_KEY, TOOL_AUTHORIZATION_STATUS_KEY } from "@/system/types.js";

const mockRequestUserInput = () => Promise.resolve("y");

describe("AllowlistMiddleware", () => {
  let stateService: StateService;

  beforeEach(() => {
    const tempDir = mkdtempSync(join(tmpdir(), "allowlist-"));
    stateService = new StateService({ appName: "test", stateDir: tempDir });
    stateService.load();
  });

  it("getAllowlist returns empty when none registered", () => {
    const mw = createAllowlistMiddleware(stateService, { requestUserInput: mockRequestUserInput });
    expect(mw.getAllowlist()).toEqual([]);
  });

  it("registerAllowedTool adds and persists to state", () => {
    const mw = createAllowlistMiddleware(stateService, { requestUserInput: mockRequestUserInput });
    mw.registerAllowedTool("scan_disk");
    expect(mw.getAllowlist()).toContain("scan_disk");
    expect(stateService.getState()[TOOL_ALLOWLIST_KEY]).toEqual(["scan_disk"]);
    mw.registerAllowedTool("delete_file");
    expect(mw.getAllowlist()).toEqual(["scan_disk", "delete_file"]);
  });

  it("filterToAllowlist returns all when allowlist empty", () => {
    const mw = createAllowlistMiddleware(stateService, { requestUserInput: mockRequestUserInput });
    expect(mw.filterToAllowlist(["a", "b"])).toEqual(["a", "b"]);
  });

  it("filterToAllowlist filters to only allowed names", () => {
    const mw = createAllowlistMiddleware(stateService, { requestUserInput: mockRequestUserInput });
    mw.registerAllowedTool("a");
    expect(mw.filterToAllowlist(["a", "b", "c"])).toEqual(["a"]);
  });

  it("requestToolAuthorization persists authorization status", async () => {
    const mw = createAllowlistMiddleware(stateService, {
      requestUserInput: () => Promise.resolve("y"),
    });
    await mw.requestToolAuthorization("test_tool", { path: "/tmp" });
    const history = stateService.getState()[TOOL_AUTHORIZATION_STATUS_KEY] as Array<{ toolName: string; allowed: boolean }>;
    expect(Array.isArray(history)).toBe(true);
    expect(history).toHaveLength(1);
    expect(history[0].toolName).toBe("test_tool");
    expect(history[0].allowed).toBe(true);
  });

  it("requestToolAuthorization persists denied when user answers n", async () => {
    const mw = createAllowlistMiddleware(stateService, {
      requestUserInput: () => Promise.resolve("n"),
    });
    await mw.requestToolAuthorization("denied_tool", { x: 1 });
    const history = stateService.getState()[TOOL_AUTHORIZATION_STATUS_KEY] as Array<{ toolName: string; allowed: boolean }>;
    expect(history).toHaveLength(1);
    expect(history[0].toolName).toBe("denied_tool");
    expect(history[0].allowed).toBe(false);
  });
});
