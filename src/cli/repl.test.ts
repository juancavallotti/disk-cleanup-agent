import { describe, it, expect } from "vitest";
import { parseLine } from "./repl.js";

describe("parseLine", () => {
  it("splits command and args", () => {
    expect(parseLine("list-providers")).toEqual({
      command: "list-providers",
      args: [],
    });
    expect(parseLine("delete-provider openai-1")).toEqual({
      command: "delete-provider",
      args: ["openai-1"],
    });
    expect(parseLine("  add-provider   ")).toEqual({
      command: "add-provider",
      args: [],
    });
  });
});
