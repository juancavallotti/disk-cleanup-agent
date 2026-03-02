---
name: disk-cleanup-report
description: Produces a disk cleanup report by exploring user-writable locations and calling report_cleanup_opportunity. Use when the user requests a cleanup report or to list safe cleanup opportunities.
---

# Disk Cleanup Report

## Rules

- As a general rule, inspect folders's contents before attempting to read their size (du as you know is expensive in terms of time), we don't want to clean up the user's working data but we can suggest things like deleting large downloads, cleaning up various caches that tend to accumulate and so forth. You may perform a web search to see what is common in the user's environment, look at the software they have installed and suggest cleanup if it's prone to accumulating clutter. Focus on known problem areas; do not blindly drill down or measure everything.
- Only consider user-writable locations: home directory, caches in home, user data. NEVER use or suggest system folders (e.g. /System, /Library, /usr on macOS; C:\Windows on Windows; /etc, /usr on Linux). Your tools will reject system paths.
- Do NOT suggest deleting work folders such as Documents, Desktop, project directories.
- For each cleanup opportunity you find, you MUST call report_cleanup_opportunity with an array "opportunities" where each item has: path, pathDescription, sizeBytes, contentsDescription, whySafeToDelete, optional suggestedAction, and optional recommendedCommand. You may report one or many opportunities per call; prefer batching multiple findings into a single call when you have several. Provide a clear contents description and safety justification for each.
- recommendedCommand: when a tool has a built-in cleanup command (e.g. npm, docker, brew, yarn), set recommendedCommand to the exact shell command the user can run (e.g. `npm cache clean --force`, `docker system prune`, `brew cleanup`). For plain folders with no tool command, you may omit recommendedCommand or set it to a safe delete command (e.g. `rm -rf "<path>"`). suggestedAction remains a short human-readable line; recommendedCommand is the copy-pastable command for the report card.
- When a command-related cache (e.g. npm, docker, brew, yarn) is using a lot of space and that command is installed, suggest using that command's own cleanup in suggestedAction and set recommendedCommand to the exact command. Prefer "run this command to clean" over "delete these files" when the cache is tied to an installed tool.
- When a folder looks too large, iteratively drill-down to look for anything suspicious.
- When looking at the user's download folders do not suggest deleting something that could be useful (photos, docs) but large binary or installation files are okay.

## Workflow

1. **Plan phase (if the user asked for a plan first):** Call get_system_type, get_current_username, and command_probe (e.g. npm, yarn, docker, brew) so the plan is OS-, user-, and tool-aware. Then output ONLY an execution plan as ASCII bullet points: list which directories you will inspect (only user locations: home, caches in home—never system folders). One bullet per step, in order. Do not use any other tools in the plan phase.
2. **Execution phase:** Call get_system_type and get_current_username so the plan is OS-aware. Call command_probe with relevant command names (e.g. npm, yarn, docker, brew). Then explore known candidate paths directly: use list_folders/list_folders_batch and list_folder_contents_by_size on cache/temp/trash and tool-related directories; use get_folder_capacity_batch to measure only the paths you are evaluating (not the home root). For each location that is safe to clean, call report_cleanup_opportunity with opportunities: [{ path, pathDescription, sizeBytes, contentsDescription, whySafeToDelete, suggestedAction?, recommendedCommand? }, ...]. When done, summarize and stop.
3. **Tools to use:** get_system_type, get_current_username, command_probe, list_folders, list_folders_batch, list_folder_contents_by_size, change_directory, get_folder_capacity, get_folder_capacity_batch, report_cleanup_opportunity. Use list_folder_contents_by_size when you need to see which files or subfolders inside a directory are large (returns a markdown table). Use get_folder_capacity_batch to measure multiple paths in parallel.

If you have the web_search tool: You may use it to look up the best way to clean or safely remove suspicious or non-obvious items. Prefer suggesting actions like "Clear via app settings", "Run `xyz` to prune", or "Safe to delete after backup" when search results support them, and put that in suggestedAction.
