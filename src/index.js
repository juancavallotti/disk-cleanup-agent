#!/usr/bin/env node

import { Command } from "commander";
import { registerSkills } from "./skills/index.js";

const program = new Command();

program
  .name("disk-cleanup")
  .description("CLI app with LangChain and OpenAI — skills-based")
  .version("0.1.0");

// Register all skills (commands) from the skills module
registerSkills(program);

program.parse();
