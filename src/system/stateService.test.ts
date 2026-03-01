import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StateService } from "./stateService.js";

describe("StateService", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "disk-cleanup-state-"));
  });

  it("returns empty state when file does not exist", () => {
    const service = new StateService({ appName: "test", stateDir: tempDir });
    const state = service.load();
    expect(state).toEqual({});
  });

  it("loads existing state from disk", () => {
    const statePath = join(tempDir, "state.json");
    writeFileSync(statePath, JSON.stringify({ foo: "bar" }), "utf-8");
    const service = new StateService({ appName: "test", stateDir: tempDir });
    const state = service.load();
    expect(state).toEqual({ foo: "bar" });
  });

  it("setState persists changes", () => {
    const service = new StateService({ appName: "test", stateDir: tempDir });
    service.load();
    service.setState((s) => {
      s.lastRun = "2025-01-01";
    });
    expect(existsSync(join(tempDir, "state.json"))).toBe(true);
    const raw = readFileSync(join(tempDir, "state.json"), "utf-8");
    expect(raw).toContain("lastRun");
  });
});
