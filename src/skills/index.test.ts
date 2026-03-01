import { describe, it, expect } from "vitest";
import { Command } from "commander";
import { registerSkills } from "./index.js";

describe("registerSkills", () => {
  it("registers without throwing", () => {
    const program = new Command();
    expect(() => registerSkills(program)).not.toThrow();
  });
});
