---
name: disk-cleanup-script
description: Produces a disk cleanup script in the user's shell (bash on mac/linux, PowerShell on Windows). Use when the user requests a cleanup script or to generate a script that performs the cleanup.
---

# Disk Cleanup Script

## Goal

Produce a single cleanup script in the user's native shell language. Do not execute the script—only generate it and submit it via the submit_cleanup_script tool.

## Rules

- Only consider user-writable locations (home, caches in home). Never suggest system folders. Your tools will reject system paths.
- The script should safely remove or clean only well-known junk-accumulators (caches, temp, trash). Prefer suggesting command-based cleanup (e.g. npm cache clean, docker system prune) in the script when the cache is tied to an installed tool.

## Workflow

1. Call get_system_type to determine the shell: use **bash** for mac or linux, **PowerShell** for windows.
2. Explore with the same filesystem tools: get_current_username, get_common_offender_paths, command_probe, list_folders, list_folder_contents_by_size, get_folder_capacity, get_folder_capacity_batch. Identify what can be safely cleaned.
3. Write a single script that performs the cleanup (e.g. rm -rf for caches on Unix, or Remove-Item on Windows; or running npm cache clean, brew cleanup, etc. where appropriate).
4. Call **submit_cleanup_script** with the full script content (scriptContent: the raw script text). Do not execute the script yourself.

## Tools to use

get_system_type, get_current_username, get_common_offender_paths, command_probe, list_folders, list_folder_contents_by_size, change_directory, get_folder_capacity, get_folder_capacity_batch, submit_cleanup_script.
