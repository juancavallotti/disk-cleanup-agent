import { describe, it, expect } from "vitest";
import { formatBytes, reportToHtml } from "./reportToHtml.js";
import type { CleanupReport } from "./reportTypes.js";

describe("formatBytes", () => {
  it("returns 0 B for zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes and kilo/mega/giga with one decimal when useful", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1073741824)).toBe("1 GB");
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB");
  });

  it("returns 0 B for NaN and negative", () => {
    expect(formatBytes(Number.NaN)).toBe("0 B");
    expect(formatBytes(-100)).toBe("0 B");
  });
});

describe("reportToHtml", () => {
  it("returns valid HTML with Tailwind CDN and human-readable size", () => {
    const report: CleanupReport = {
      generatedAt: "2025-03-01T14:30:00.000Z",
      system: "darwin",
      backupWarning: "Back up before deleting.",
      opportunities: [
        {
          path: "/Users/me/.cache/app",
          pathDescription: "App cache directory",
          sizeBytes: 1536,
          contentsDescription: "Temporary cache files",
          whySafeToDelete: "Regenerated on next run",
          suggestedAction: "Delete folder",
        },
      ],
    };
    const html = reportToHtml(report);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("https://cdn.tailwindcss.com");
    expect(html).toContain("Back up before deleting.");
    expect(html).toContain("1.5 KB");
    expect(html).toContain("/Users/me/.cache/app");
    expect(html).toContain("App cache directory");
    expect(html).toContain("Temporary cache files");
    expect(html).toContain("Regenerated on next run");
    expect(html).toContain("Delete folder");
  });

  it("includes backup warning and handles empty opportunities", () => {
    const report: CleanupReport = {
      generatedAt: "2025-01-01T00:00:00.000Z",
      system: "linux",
      backupWarning: "Verify before removing.",
      opportunities: [],
    };
    const html = reportToHtml(report);
    expect(html).toContain("Verify before removing.");
    expect(html).toContain("No opportunities recorded.");
    expect(html).toContain("Cleanup opportunities (0)");
  });

  it("includes model in header when present", () => {
    const report: CleanupReport = {
      generatedAt: "2025-03-01T12:00:00.000Z",
      system: "darwin",
      backupWarning: "Back up first.",
      model: "gpt-4o-mini",
      opportunities: [],
    };
    const html = reportToHtml(report);
    expect(html).toContain("Model: gpt-4o-mini");
  });

  it("renders recommendedCommand in card with copy icon", () => {
    const report: CleanupReport = {
      generatedAt: "2025-03-01T12:00:00.000Z",
      system: "darwin",
      backupWarning: "Back up first.",
      opportunities: [
        {
          path: "/Users/me/.npm",
          pathDescription: "npm cache",
          sizeBytes: 1024,
          contentsDescription: "npm cache",
          whySafeToDelete: "Safe to clear",
          recommendedCommand: "npm cache clean --force",
        },
      ],
    };
    const html = reportToHtml(report);
    expect(html).toContain("Recommended command");
    expect(html).toContain("npm cache clean --force");
    expect(html).toContain("heroicons@2.2.0/24/outline/clipboard-document.svg");
  });

  it("renders opportunities biggest to smallest by sizeBytes", () => {
    const report: CleanupReport = {
      generatedAt: "2025-03-01T12:00:00.000Z",
      system: "darwin",
      backupWarning: "Back up first.",
      opportunities: [
        { path: "/small", pathDescription: "Small", sizeBytes: 100, contentsDescription: "x", whySafeToDelete: "y" },
        { path: "/big", pathDescription: "Big", sizeBytes: 5000, contentsDescription: "x", whySafeToDelete: "y" },
        { path: "/medium", pathDescription: "Medium", sizeBytes: 500, contentsDescription: "x", whySafeToDelete: "y" },
      ],
    };
    const html = reportToHtml(report);
    const idxLargest = html.indexOf("4.9 KB"); // 5000 bytes
    const idxMedium = html.indexOf("500 B");
    const idxSmallest = html.indexOf("100 B");
    expect(idxLargest).toBeGreaterThan(-1);
    expect(idxMedium).toBeGreaterThan(-1);
    expect(idxSmallest).toBeGreaterThan(-1);
    expect(idxLargest).toBeLessThan(idxMedium);
    expect(idxMedium).toBeLessThan(idxSmallest);
  });
});
