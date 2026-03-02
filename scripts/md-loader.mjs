/**
 * Node ESM loader: treat *.md imports as raw string (default export).
 * Use with: node --import ./scripts/register-md.mjs dist/index.js
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MD_SUFFIX = ".md";

export async function load(url, context, nextLoad) {
  if (url.endsWith(MD_SUFFIX)) {
    const path = fileURLToPath(url);
    const content = readFileSync(path, "utf-8");
    const source = `export default ${JSON.stringify(content)};`;
    return { format: "module", shortCircuit: true, source };
  }
  return nextLoad(url, context);
}
