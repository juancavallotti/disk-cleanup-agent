import { describe, it, expect } from "vitest";
import { getSkillTool } from "./getSkill.js";

describe("getSkillTool", () => {
  it("has correct name and description", () => {
    expect(getSkillTool.name).toBe("get_skill");
    expect(getSkillTool.description).toContain("skill");
    expect(getSkillTool.description).toContain("report");
    expect(getSkillTool.description).toContain("script");
  });

  it("returns report skill content when skillName is report", async () => {
    const out = await getSkillTool.invoke({ skillName: "report" });
    expect(typeof out).toBe("string");
    expect(out).toContain("report_cleanup_opportunity");
    expect(out).toContain("Rules");
    expect(out).not.toContain("Skill \"report\" not found");
  });

  it("returns script skill content when skillName is script", async () => {
    const out = await getSkillTool.invoke({ skillName: "script" });
    expect(typeof out).toBe("string");
    expect(out).toContain("submit_cleanup_script");
    expect(out).toContain("bash");
    expect(out).not.toContain("Skill \"script\" not found");
  });

  it("returns error for unknown skill name", async () => {
    const out = await getSkillTool.invoke({ skillName: "unknown" });
    expect(out).toContain("Unknown skill");
    expect(out).toContain("report");
    expect(out).toContain("script");
  });
});
