import { describe, it, expect } from "vitest";
import { getSystemTypeTool } from "./getSystemType.js";

describe("getSystemTypeTool", () => {
  it("has correct name and description", () => {
    expect(getSystemTypeTool.name).toBe("get_system_type");
    expect(getSystemTypeTool.description).toContain("operating system");
  });

  it("returns mac, windows, or linux", async () => {
    const out = await getSystemTypeTool.invoke({});
    expect(["mac", "windows", "linux"]).toContain(out);
  });
});
