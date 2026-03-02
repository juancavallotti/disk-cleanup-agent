/**
 * Report schema for disk cleanup opportunities.
 * Stored as YAML in ~/.<appName>/reports/
 */

export interface CleanupOpportunity {
  path: string;
  pathDescription: string;
  sizeBytes: number;
  contentsDescription: string;
  whySafeToDelete: string;
  suggestedAction?: string;
}

export interface CleanupReport {
  generatedAt: string;
  system: string;
  backupWarning: string;
  opportunities: CleanupOpportunity[];
}

export const DEFAULT_BACKUP_WARNING =
  "Back up important data before deleting. This report suggests locations that may be safe to clean; verify before removing.";
