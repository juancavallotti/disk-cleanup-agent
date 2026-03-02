/**
 * Tool: get_system_type — returns the current OS (mac, windows, linux).
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getPlatformName } from "./systemPaths.js";

export const getSystemTypeTool = tool(
  () => {
    return getPlatformName();
  },
  {
    name: "get_system_type",
    description: "Returns the current operating system: mac, windows, or linux. Use this to know which paths are safe to inspect (e.g. user home, caches) and which are system paths to avoid.",
    schema: z.object({}),
  }
);
