/**
 * Skills registry — add new skills here as commands.
 * Each skill can use LangChain and/or OpenAI as needed.
 */

import type { Command } from "commander";

export function registerSkills(program: Command): void {
  // Placeholder: no skills registered yet.
  // Example when you add a skill:
  // const { command } = await import("./my-skill.js");
  // program.addCommand(command);
}
