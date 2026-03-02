/**
 * Transform CleanupReport to HTML for browser display. Pure functions only; no I/O.
 * Uses Tailwind CSS via CDN. Formats file sizes in human-readable form.
 */

import type { CleanupReport, CleanupOpportunity } from "./reportTypes.js";

const TAILWIND_CDN = "https://cdn.tailwindcss.com";

/** Escape HTML special chars for safe text content. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Convert bytes to human-readable size (B, KB, MB, GB, TB).
 * One decimal when useful. Handles 0, NaN, and negative (returns "0 B" for invalid).
 */
export function formatBytes(sizeBytes: number): string {
  if (typeof sizeBytes !== "number" || Number.isNaN(sizeBytes) || sizeBytes < 0) {
    return "0 B";
  }
  if (sizeBytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let u = 0;
  let n = sizeBytes;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  const value = u === 0 ? n : Number(n.toFixed(1));
  return `${value} ${units[u]}`;
}

/**
 * Format an ISO date string for display (e.g. "Mar 1, 2025, 3:45 PM").
 */
function formatGeneratedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/**
 * Render a single opportunity as HTML (card section).
 */
function opportunityToHtml(opp: CleanupOpportunity): string {
  const size = formatBytes(opp.sizeBytes);
  const pathEsc = escapeHtml(opp.path);
  const pathDescEsc = escapeHtml(opp.pathDescription);
  const contentsEsc = escapeHtml(opp.contentsDescription);
  const whyEsc = escapeHtml(opp.whySafeToDelete);
  const actionEsc = opp.suggestedAction ? escapeHtml(opp.suggestedAction) : null;

  let html = `
    <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <code class="text-sm text-gray-800 break-all">${pathEsc}</code>
        <span class="shrink-0 rounded bg-blue-100 px-2 py-1 text-sm font-semibold text-blue-800">${escapeHtml(size)}</span>
      </div>
      <p class="mt-2 text-sm text-gray-600">${pathDescEsc}</p>
      <div class="mt-3">
        <p class="text-sm text-gray-700"><span class="font-medium">Contents:</span> ${contentsEsc}</p>
        <p class="mt-1 text-sm text-gray-700"><span class="font-medium">Why safe to delete:</span> ${whyEsc}</p>
        ${actionEsc ? `<p class="mt-1 text-sm text-green-700"><span class="font-medium">Suggested action:</span> ${actionEsc}</p>` : ""}
      </div>
    </section>`;
  return html.trim();
}

/**
 * Generate a full HTML document from a CleanupReport.
 * Uses Tailwind Play CDN; human-readable sizes and semantic structure.
 */
export function reportToHtml(report: CleanupReport): string {
  const title = "Disk Cleanup Report";
  const warningEsc = escapeHtml(report.backupWarning ?? "");
  const systemEsc = escapeHtml(report.system ?? "");
  const generatedEsc = escapeHtml(formatGeneratedAt(report.generatedAt));
  const opportunities = report.opportunities ?? [];
  const cardsHtml = opportunities.map(opportunityToHtml).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <script src="${TAILWIND_CDN}"></script>
</head>
<body class="bg-gray-50 text-gray-900 antialiased">
  <div class="mx-auto max-w-4xl px-4 py-8">
    <header class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900">${escapeHtml(title)}</h1>
      <p class="mt-1 text-sm text-gray-500">Generated: ${generatedEsc} · System: ${systemEsc}</p>
    </header>

    <div class="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4" role="alert">
      <p class="text-sm font-medium text-amber-800">${warningEsc}</p>
    </div>

    <h2 class="mb-4 text-lg font-semibold text-gray-800">Cleanup opportunities (${opportunities.length})</h2>
    <div class="space-y-4">
${cardsHtml ? "      " + cardsHtml.split("\n").join("\n      ") : '      <p class="text-sm text-gray-500">No opportunities recorded.</p>'}
    </div>
  </div>
</body>
</html>`;
}
