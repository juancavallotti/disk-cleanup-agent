/**
 * Tool: get_skill — load task-specific instructions from a SKILL.md file by name.
 * Returns the full content of the skill so the agent can follow it.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, "..", "skills");

const ALLOWED_SKILLS = ["report", "script"] as const;

function getSkillPath(skillName: string): string | null {
  const normalized = skillName.trim().toLowerCase();
  if (!ALLOWED_SKILLS.includes(normalized as (typeof ALLOWED_SKILLS)[number])) {
    return null;
  }
  return join(SKILLS_DIR, normalized, "SKILL.md");
}

export const getSkillTool = tool(
  (input: { skillName: string }) => {
    const path = getSkillPath(input.skillName);
    if (path === null) {
      return `Unknown skill: "${input.skillName}". Allowed: ${ALLOWED_SKILLS.join(", ")}`;
    }
    if (!existsSync(path)) {
      return `Skill "${input.skillName}" not found at ${path}. Ensure SKILL.md exists for this skill.`;
    }
    try {
      return readFileSync(path, "utf-8");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Failed to read skill "${input.skillName}": ${message}`;
    }
  },
  {
    name: "get_skill",
    description:
      "Load task-specific instructions by skill name. Call with skillName 'report' to get instructions for producing a disk cleanup report, or 'script' to get instructions for producing a cleanup script. Use the skill content to know which tools to call and how to complete the task.",
    schema: z.object({
      skillName: z
        .string()
        .describe("The skill to load: 'report' (cleanup report) or 'script' (cleanup script)."),
    }),
  }
);
