/**
 * Tool: get_common_offender_paths — returns common cache/temp/junk paths for the current OS (relative to home).
 * Use as quick wins; agent must still explore the filesystem.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getPlatformName } from "./systemPaths.js";
import { getCommonOffenderPaths } from "./commonOffenders.js";

export const getCommonOffenderPathsTool = tool(
  () => {
    const platform = getPlatformName() as "mac" | "windows" | "linux";
    const entries = getCommonOffenderPaths(platform);
    return JSON.stringify(entries, null, 2);
  },
  {
    name: "get_common_offender_paths",
    description:
      "Returns common disk-space offender paths for the current OS (relative to user home), e.g. .cache, .npm, Library/Caches. Use these as quick wins to measure first; you must still explore the filesystem with list_folders and list_folder_contents_by_size. Each entry has path and optional label.",
    schema: z.object({}),
  }
);
