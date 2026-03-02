/**
 * Transform script path + content to HTML for browser display with syntax highlighting.
 * Uses Tailwind and Prism.js from CDN.
 */

const TAILWIND_CDN = "https://cdn.tailwindcss.com";
const PRISM_JS = "https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js";
const PRISM_CSS = "https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css";

export type ShellType = "mac" | "windows" | "linux";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function prismLanguage(shellType: ShellType): string {
  return shellType === "windows" ? "powershell" : "bash";
}

export interface ScriptViewInput {
  scriptPath: string;
  scriptContent: string;
  shellType: ShellType;
}

/**
 * Generate a full HTML document showing the script path (copyable) and syntax-highlighted script content.
 */
export function scriptToHtml(input: ScriptViewInput): string {
  const { scriptPath, scriptContent, shellType } = input;
  const pathEsc = escapeHtml(scriptPath);
  const contentEsc = escapeHtml(scriptContent);
  const lang = prismLanguage(shellType);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cleanup Script</title>
  <script src="${TAILWIND_CDN}"></script>
  <link rel="stylesheet" href="${PRISM_CSS}" />
</head>
<body class="bg-gray-50 text-gray-900 antialiased">
  <div class="mx-auto max-w-4xl px-4 py-8">
    <header class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Cleanup Script</h1>
      <p class="mt-2 text-sm text-gray-600">Script path (copy to run in your shell):</p>
      <div class="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-sm">
        <code id="script-path" class="flex-1 break-all text-gray-800">${pathEsc}</code>
        <button type="button" onclick="navigator.clipboard.writeText(document.getElementById('script-path').textContent); this.textContent='Copied!'; setTimeout(()=>this.textContent='Copy', 1500)" class="shrink-0 rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300">Copy</button>
      </div>
    </header>

    <section class="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      <pre class="!m-0 !rounded-none"><code class="language-${escapeHtml(lang)}">${contentEsc}</code></pre>
    </section>
  </div>
  <script src="${PRISM_JS}"></script>
  <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-bash.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-powershell.min.js"></script>
  <script>Prism.highlightAll();</script>
</body>
</html>`;
}
