import { describe, it, expect } from "vitest";
import { createReportCleanupOpportunityTool } from "./reportCleanupOpportunity.js";
import type { CleanupOpportunity } from "@/services/reportTypes.js";

describe("createReportCleanupOpportunityTool", () => {
  it("pushes single opportunity to accumulator", async () => {
    const collected: CleanupOpportunity[] = [];
    const accumulator = { push: (o: CleanupOpportunity) => collected.push(o) };
    const tool = createReportCleanupOpportunityTool(accumulator);
    await tool.invoke({
      opportunities: [
        {
          path: "/home/user/.cache",
          pathDescription: "User cache",
          sizeBytes: 1000,
          contentsDescription: "Application cache files",
          whySafeToDelete: "Regenerated on next run",
          suggestedAction: "Delete folder",
        },
      ],
    });
    expect(collected).toHaveLength(1);
    expect(collected[0].path).toBe("/home/user/.cache");
    expect(collected[0].sizeBytes).toBe(1000);
    expect(collected[0].whySafeToDelete).toBe("Regenerated on next run");
  });

  it("stores recommendedCommand when provided", async () => {
    const collected: CleanupOpportunity[] = [];
    const accumulator = { push: (o: CleanupOpportunity) => collected.push(o) };
    const tool = createReportCleanupOpportunityTool(accumulator);
    await tool.invoke({
      opportunities: [
        {
          path: "/home/user/.npm",
          pathDescription: "npm cache",
          sizeBytes: 50000,
          contentsDescription: "npm cache",
          whySafeToDelete: "Reinstall on next npm install",
          recommendedCommand: "npm cache clean --force",
        },
      ],
    });
    expect(collected).toHaveLength(1);
    expect(collected[0].recommendedCommand).toBe("npm cache clean --force");
  });

  it("pushes multiple opportunities in one call (batch)", async () => {
    const collected: CleanupOpportunity[] = [];
    const accumulator = { push: (o: CleanupOpportunity) => collected.push(o) };
    const tool = createReportCleanupOpportunityTool(accumulator);
    await tool.invoke({
      opportunities: [
        { path: "/home/user/.cache", pathDescription: "Cache", sizeBytes: 1000, contentsDescription: "Cache", whySafeToDelete: "Safe" },
        { path: "/home/user/.npm", pathDescription: "npm cache", sizeBytes: 2000, contentsDescription: "npm", whySafeToDelete: "Reinstall" },
      ],
    });
    expect(collected).toHaveLength(2);
    expect(collected[0].path).toBe("/home/user/.cache");
    expect(collected[1].path).toBe("/home/user/.npm");
    expect(collected[0].sizeBytes).toBe(1000);
    expect(collected[1].sizeBytes).toBe(2000);
  });

  it("returns confirmation message", async () => {
    const accumulator = { push: () => {} };
    const tool = createReportCleanupOpportunityTool(accumulator);
    const out = await tool.invoke({
      opportunities: [
        { path: "/tmp/x", pathDescription: "Temp", sizeBytes: 500, contentsDescription: "Temp files", whySafeToDelete: "Safe" },
      ],
    });
    expect(out).toContain("Recorded");
    expect(out).toContain("500");
  });
});
