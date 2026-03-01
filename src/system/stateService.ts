/**
 * State service: owns ~/.<appName>/state.json.
 * Only this service reads/writes the state file.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

const STATE_FILENAME = "state.json";

export interface StateServiceOptions {
  appName: string;
  /** Override for tests; defaults to ~/.<appName> */
  stateDir?: string;
}

export interface AppState {
  [key: string]: unknown;
}

export class StateService {
  private readonly statePath: string;
  private state: AppState = {};

  constructor(options: StateServiceOptions) {
    const { appName, stateDir } = options;
    const dir = stateDir ?? join(homedir(), `.${appName}`);
    this.statePath = join(dir, STATE_FILENAME);
  }

  load(): AppState {
    if (!existsSync(this.statePath)) {
      this.state = {};
      return this.state;
    }
    const raw = readFileSync(this.statePath, "utf-8");
    try {
      this.state = JSON.parse(raw) as AppState;
    } catch {
      this.state = {};
    }
    return this.state;
  }

  getState(): AppState {
    return this.state;
  }

  setState(updater: (state: AppState) => void): void {
    updater(this.state);
    this.persist();
  }

  private persist(): void {
    const dir = dirname(this.statePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.statePath, JSON.stringify(this.state, null, 2), "utf-8");
  }
}
