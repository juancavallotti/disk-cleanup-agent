import { describe, it, expect } from "vitest";
import { parseLine } from "./repl.js";

describe("parseLine", () => {
  it("splits command and args", () => {
    expect(parseLine("help")).toEqual({
      command: "help",
      args: [],
    });
    expect(parseLine("provider list")).toEqual({
      command: "provider",
      args: ["list"],
    });
    expect(parseLine("provider delete openai-1")).toEqual({
      command: "provider",
      args: ["delete", "openai-1"],
    });
    expect(parseLine("  provider add   ")).toEqual({
      command: "provider",
      args: ["add"],
    });
    expect(parseLine("provider select")).toEqual({
      command: "provider",
      args: ["select"],
    });
    expect(parseLine("provider delete")).toEqual({
      command: "provider",
      args: ["delete"],
    });
  });
});
