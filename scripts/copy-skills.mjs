/**
 * Copy src/agent/skills (all .md files) to dist/agent/skills so the built app can load them.
 * Run after tsc (e.g. in build script).
 */
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcSkills = join(root, "src", "agent", "skills");
const distSkills = join(root, "dist", "agent", "skills");

if (!existsSync(srcSkills)) {
  console.warn("copy-skills: src/agent/skills not found, skipping");
  process.exit(0);
}

mkdirSync(distSkills, { recursive: true });
cpSync(srcSkills, distSkills, { recursive: true });
console.log("copy-skills: copied src/agent/skills to dist/agent/skills");
