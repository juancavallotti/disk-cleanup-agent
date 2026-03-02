import { describe, it, expect } from "vitest";
import { homedir } from "node:os";
import { expandTilde } from "./pathUtils.js";

describe("expandTilde", () => {
  it("expands ~ to homedir", () => {
    expect(expandTilde("~")).toBe(homedir());
  });

  it("expands ~/path to homedir/path", () => {
    const home = homedir();
    expect(expandTilde("~/Library/Caches")).toBe(`${home}/Library/Caches`);
    expect(expandTilde("~/.cache")).toBe(`${home}/.cache`);
  });

  it("leaves non-tilde paths unchanged", () => {
    expect(expandTilde("/absolute/path")).toBe("/absolute/path");
    expect(expandTilde("relative/path")).toBe("relative/path");
  });
});
