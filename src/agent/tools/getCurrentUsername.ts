/**
 * Tool: get_current_username — returns the current system username.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { userInfo } from "node:os";

export const getCurrentUsernameTool = tool(
  () => {
    return userInfo().username;
  },
  {
    name: "get_current_username",
    description:
      "Returns the current system username. Use this to know which user's home directory and caches to inspect (e.g. ~ or /Users/<username> on macOS).",
    schema: z.object({}),
  }
);
