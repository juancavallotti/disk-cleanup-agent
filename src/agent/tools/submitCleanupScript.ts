/**
 * Tool: submit_cleanup_script — write the agent-generated cleanup script to disk.
 * Uses a script accumulator that holds the path (from script service) and receives the content.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { writeFileSync } from "node:fs";

export interface ScriptAccumulator {
  scriptPath: string;
  scriptContent: string | null;
  shellType: "mac" | "windows" | "linux";
}

export function createSubmitCleanupScriptTool(accumulator: ScriptAccumulator) {
  const func = (input: { scriptContent: string }) => {
    const { scriptPath } = accumulator;
    const content = input.scriptContent ?? "";
    writeFileSync(scriptPath, content, "utf-8");
    accumulator.scriptContent = content;
    return `Script written to ${scriptPath}. The user can run it in their shell or review it in the browser.`;
  };
  return tool(func as (input: unknown) => string, {
    name: "submit_cleanup_script",
    description:
      "Submit the full cleanup script content. Call this once you have produced the complete script (bash for mac/linux, PowerShell for Windows). Do not execute the script—only pass its contents here. The script will be saved to a file and shown to the user.",
    schema: z.object({
      scriptContent: z.string().describe("The full script content (e.g. bash or PowerShell) to save."),
    }),
  });
}
