/**
 * Script service: reserve paths and write cleanup scripts in ~/.<appName>/scripts/
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ConfigService } from "@/system/configService.js";

const SCRIPTS_DIR = "scripts";

export type ScriptExtension = ".sh" | ".ps1";

export interface ScriptServiceOptions {
  configService: ConfigService;
}

export class ScriptService {
  private readonly scriptsDir: string;

  constructor(options: ScriptServiceOptions) {
    const { configService } = options;
    this.scriptsDir = join(configService.getConfigDir(), SCRIPTS_DIR);
  }

  private ensureDir(): void {
    if (!existsSync(this.scriptsDir)) {
      mkdirSync(this.scriptsDir, { recursive: true });
    }
  }

  /**
   * Return the next script path for the given extension. Does not create the file.
   * Filename: cleanup-<ISO-timestamp>.<sh|ps1>
   */
  getNextScriptPath(extension: ScriptExtension): string {
    this.ensureDir();
    const id = new Date().toISOString().replace(/[:.]/g, "-").replace(/Z$/, "Z");
    const filename = `cleanup-${id}${extension}`;
    return join(this.scriptsDir, filename);
  }

  /**
   * Write script content to the given path. Path should come from getNextScriptPath.
   */
  writeScript(path: string, content: string): void {
    this.ensureDir();
    writeFileSync(path, content, "utf-8");
  }
}
