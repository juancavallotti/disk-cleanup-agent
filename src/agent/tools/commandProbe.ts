/**
 * Tool: command_probe — check if one or more allowlisted CLI commands are installed.
 * Only commands on the allowlist may be probed; others are skipped.
 */

import { platform } from "node:os";
import { execSync } from "node:child_process";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const ALLOWED_PROBE_COMMANDS = new Set([
  "npm",
  "yarn",
  "pnpm",
  "node",
  "docker",
  "brew",
  "cargo",
  "go",
  "pip",
  "pip3",
  "gradle",
  "mvn",
  "pod",
  "gem",
  "dotnet",
]);

export interface CommandProbeResult {
  command: string;
  installed: boolean;
  path?: string;
}

function probeCommand(command: string): CommandProbeResult {
  const isWindows = platform() === "win32";
  try {
    if (isWindows) {
      const out = execSync(`where ${command}`, { encoding: "utf8", timeout: 5000 });
      const firstLine = out.split(/\r?\n/)[0]?.trim();
      return { command, installed: true, path: firstLine || undefined };
    } else {
      const out = execSync(`command -v ${command}`, { encoding: "utf8", timeout: 5000 });
      const path = out.split(/\r?\n/)[0]?.trim();
      return { command, installed: true, path: path || undefined };
    }
  } catch {
    return { command, installed: false };
  }
}

export function createCommandProbeTool() {
  return tool(
    (input: { commands: string[] }) => {
      const requested = input.commands ?? [];
      const allowed = requested.filter((cmd) => typeof cmd === "string" && ALLOWED_PROBE_COMMANDS.has(cmd.trim()));
      const skipped = requested.filter((cmd) => typeof cmd === "string" && cmd.trim() && !ALLOWED_PROBE_COMMANDS.has(cmd.trim()));
      const results: CommandProbeResult[] = allowed.map((cmd) => probeCommand(cmd.trim()));
      const summary: { results: CommandProbeResult[]; skipped?: string[] } = { results };
      if (skipped.length > 0) {
        summary.skipped = skipped;
      }
      return JSON.stringify(summary, null, 2);
    },
    {
      name: "command_probe",
      description:
        "Check if one or more CLI commands are installed (e.g. npm, yarn, docker, brew). Pass an array of command names. Only allowlisted commands are probed; others are skipped. Returns for each: command, installed (boolean), and path when installed. Use this when building the plan to prioritize relevant caches (e.g. if npm is installed, check npm cache).",
      schema: z.object({
        commands: z.array(z.string()).describe("Array of command names to probe (e.g. ['npm', 'docker', 'brew']). Only allowlisted commands are checked."),
      }),
    }
  );
}
