import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync, existsSync } from "node:fs";
import { ConfigService } from "@/system/configService.js";
import { ReportService } from "./reportService.js";
import type { CleanupReport } from "./reportTypes.js";

describe("ReportService", () => {
  let configService: ConfigService;
  let reportService: ReportService;

  beforeEach(() => {
    const tempDir = mkdtempSync(join(tmpdir(), "report-svc-"));
    configService = new ConfigService({ appName: "test", configDir: tempDir });
    configService.loadConfig();
    reportService = new ReportService({ configService });
  });

  it("saveReport creates report file and returns path", () => {
    const report: CleanupReport = {
      generatedAt: "2025-01-01T12:00:00.000Z",
      system: "mac",
      backupWarning: "Back up first.",
      opportunities: [],
    };
    const path = reportService.saveReport(report);
    expect(path).toContain("report-");
    expect(path).toContain(".yaml");
    expect(existsSync(path)).toBe(true);
    const raw = readFileSync(path, "utf-8");
    expect(raw).toContain("Back up first.");
    expect(raw).toContain("mac");
  });

  it("listReports returns saved report paths", () => {
    const report: CleanupReport = {
      generatedAt: "2025-01-01T12:00:00.000Z",
      system: "mac",
      backupWarning: "Back up first.",
      opportunities: [],
    };
    reportService.saveReport(report);
    const list = reportService.listReports();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]).toContain(".yaml");
  });

  it("getReport loads report by path", () => {
    const report: CleanupReport = {
      generatedAt: "2025-01-01T12:00:00.000Z",
      system: "linux",
      backupWarning: "Verify before deleting.",
      opportunities: [{ path: "/home/x/cache", pathDescription: "Cache", sizeBytes: 100, contentsDescription: "Temp", whySafeToDelete: "Regenerated" }],
    };
    const path = reportService.saveReport(report);
    const loaded = reportService.getReport(path);
    expect(loaded).not.toBeNull();
    expect(loaded!.system).toBe("linux");
    expect(loaded!.opportunities).toHaveLength(1);
    expect(loaded!.opportunities[0].path).toBe("/home/x/cache");
  });
});
