/**
 * Registers the .md loader so that import x from "./file.md" returns the file content as default export.
 * Run with: node --import ./scripts/register-md.mjs your-app.js
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const loaderPath = pathToFileURL(join(__dirname, "md-loader.mjs")).href;
register(loaderPath, import.meta.url);
