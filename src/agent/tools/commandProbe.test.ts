import { describe, it, expect } from "vitest";
import { createCommandProbeTool } from "./commandProbe.js";

describe("createCommandProbeTool", () => {
  it("has correct name and description", () => {
    const tool = createCommandProbeTool();
    expect(tool.name).toBe("command_probe");
    expect(tool.description).toContain("installed");
    expect(tool.description).toContain("allowlist");
  });

  it("returns installed: true and path for allowlisted command that exists (node)", async () => {
    const tool = createCommandProbeTool();
    const out = await tool.invoke({ commands: ["node"] });
    const parsed = JSON.parse(out as string) as { results: Array<{ command: string; installed: boolean; path?: string }> };
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].command).toBe("node");
    expect(parsed.results[0].installed).toBe(true);
    expect(parsed.results[0].path).toBeDefined();
    expect(typeof parsed.results[0].path).toBe("string");
  });

  it("returns installed: false for allowlisted command not in PATH", async () => {
    const tool = createCommandProbeTool();
    // "pod" (CocoaPods) is allowlisted but often not installed on Linux/Windows CI
    const out = await tool.invoke({ commands: ["pod"] });
    const parsed = JSON.parse(out as string) as { results: Array<{ command: string; installed: boolean; path?: string }> };
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].command).toBe("pod");
    expect(typeof parsed.results[0].installed).toBe("boolean");
    if (!parsed.results[0].installed) {
      expect(parsed.results[0].path).toBeUndefined();
    }
  });

  it("skips disallowed commands and does not probe them", async () => {
    const tool = createCommandProbeTool();
    const out = await tool.invoke({ commands: ["npm", "rm", "sudo", "node"] });
    const parsed = JSON.parse(out as string) as {
      results: Array<{ command: string; installed: boolean }>;
      skipped?: string[];
    };
    expect(parsed.results.map((r) => r.command).sort()).toEqual(["node", "npm"]);
    expect(parsed.skipped).toEqual(["rm", "sudo"]);
  });

  it("probes multiple allowlisted commands", async () => {
    const tool = createCommandProbeTool();
    const out = await tool.invoke({ commands: ["node", "npm"] });
    const parsed = JSON.parse(out as string) as { results: Array<{ command: string; installed: boolean }> };
    expect(parsed.results).toHaveLength(2);
    const commands = parsed.results.map((r) => r.command).sort();
    expect(commands).toEqual(["node", "npm"]);
  });
});
