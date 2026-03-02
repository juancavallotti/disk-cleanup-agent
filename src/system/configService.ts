/**
 * Configuration service: owns ~/.<appName>/config.yaml.
 * Loads or creates default config; exposes getConfig and updateConfig for DI.
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import YAML from "yaml";
import type { AppConfig } from "./types.js";

const CONFIG_FILENAME = "config.yaml";

function getConfigPath(configDir: string): string {
  return join(configDir, CONFIG_FILENAME);
}

const DEFAULT_RECURSION_LIMIT = 100;

function defaultConfig(): AppConfig {
  return { providers: [], recursionLimit: DEFAULT_RECURSION_LIMIT };
}

export interface ConfigServiceOptions {
  appName: string;
  /** Override for tests; defaults to ~/.<appName> */
  configDir?: string;
}

export class ConfigService {
  private readonly configDir: string;
  private config: AppConfig;

  constructor(options: ConfigServiceOptions) {
    const { appName, configDir } = options;
    this.configDir = configDir ?? join(homedir(), `.${appName}`);
    this.config = defaultConfig();
  }

  getConfigDir(): string {
    return this.configDir;
  }

  /**
   * Load config from disk; if file does not exist, create default and persist it.
   */
  loadConfig(): AppConfig {
    const path = getConfigPath(this.configDir);
    if (!existsSync(path)) {
      this.config = defaultConfig();
      this.persist();
      return this.config;
    }
    const raw = readFileSync(path, "utf-8");
    const parsed = YAML.parse(raw) as Partial<AppConfig> | null;
    const limit = parsed?.recursionLimit;
    this.config = {
      providers: Array.isArray(parsed?.providers) ? parsed.providers : [],
      recursionLimit:
        typeof limit === "number" && Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_RECURSION_LIMIT,
    };
    return this.config;
  }

  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Update config in memory and persist. Only way for other modules to change config.
   */
  updateConfig(updater: (config: AppConfig) => void): void {
    updater(this.config);
    this.persist();
  }

  private persist(): void {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }
    const path = getConfigPath(this.configDir);
    writeFileSync(path, YAML.stringify(this.config), "utf-8");
  }
}
