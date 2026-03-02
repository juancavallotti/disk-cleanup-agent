/**
 * Report service: save and list cleanup reports in ~/.<appName>/reports/
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import type { ConfigService } from "@/system/configService.js";
import type { CleanupReport } from "./reportTypes.js";

const REPORTS_DIR = "reports";

export interface ReportServiceOptions {
  configService: ConfigService;
}

export class ReportService {
  private readonly reportsDir: string;

  constructor(options: ReportServiceOptions) {
    const { configService } = options;
    this.reportsDir = join(configService.getConfigDir(), REPORTS_DIR);
  }

  private ensureDir(): void {
    if (!existsSync(this.reportsDir)) {
      mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Save a report to YAML. Filename: report-<id>.yaml where id is generatedAt (ISO) or a slug.
   */
  saveReport(report: CleanupReport): string {
    this.ensureDir();
    const id = report.generatedAt.replace(/[:.]/g, "-").replace(/Z$/, "Z");
    const filename = `report-${id}.yaml`;
    const path = join(this.reportsDir, filename);
    writeFileSync(path, YAML.stringify(report), "utf-8");
    return path;
  }

  /**
   * List report file paths (full paths), newest first by filename.
   */
  listReports(): string[] {
    this.ensureDir();
    if (!existsSync(this.reportsDir)) return [];
    const files = readdirSync(this.reportsDir)
      .filter((f) => f.startsWith("report-") && (f.endsWith(".yaml") || f.endsWith(".yml")))
      .map((f) => join(this.reportsDir, f))
      .sort()
      .reverse();
    return files;
  }

  /**
   * Load a report by full path.
   */
  getReport(filePath: string): CleanupReport | null {
    if (!existsSync(filePath)) return null;
    try {
      const raw = readFileSync(filePath, "utf-8");
      return YAML.parse(raw) as CleanupReport;
    } catch {
      return null;
    }
  }
}
