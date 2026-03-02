import { describe, it, expect } from "vitest";
import { createReportCleanupOpportunityTool } from "./reportCleanupOpportunity.js";
import type { CleanupOpportunity } from "@/services/reportTypes.js";

describe("createReportCleanupOpportunityTool", () => {
  it("pushes opportunity to accumulator", async () => {
    const collected: CleanupOpportunity[] = [];
    const accumulator = { push: (o: CleanupOpportunity) => collected.push(o) };
    const tool = createReportCleanupOpportunityTool(accumulator);
    await tool.invoke({
      path: "/home/user/.cache",
      pathDescription: "User cache",
      sizeBytes: 1000,
      contentsDescription: "Application cache files",
      whySafeToDelete: "Regenerated on next run",
      suggestedAction: "Delete folder",
    });
    expect(collected).toHaveLength(1);
    expect(collected[0].path).toBe("/home/user/.cache");
    expect(collected[0].sizeBytes).toBe(1000);
    expect(collected[0].whySafeToDelete).toBe("Regenerated on next run");
  });

  it("returns confirmation message", async () => {
    const accumulator = { push: () => {} };
    const tool = createReportCleanupOpportunityTool(accumulator);
    const out = await tool.invoke({
      path: "/tmp/x",
      pathDescription: "Temp",
      sizeBytes: 500,
      contentsDescription: "Temp files",
      whySafeToDelete: "Safe",
    });
    expect(out).toContain("Recorded");
    expect(out).toContain("500");
  });
});
