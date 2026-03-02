import { describe, it, expect } from "vitest";
import { getCurrentUsernameTool } from "./getCurrentUsername.js";

describe("getCurrentUsernameTool", () => {
  it("has correct name and description", () => {
    expect(getCurrentUsernameTool.name).toBe("get_current_username");
    expect(getCurrentUsernameTool.description).toContain("username");
  });

  it("returns a non-empty string", async () => {
    const out = await getCurrentUsernameTool.invoke({});
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });
});
