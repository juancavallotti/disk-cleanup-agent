import { describe, it, expect } from "vitest";
import { scriptToHtml } from "./scriptToHtml.js";

describe("scriptToHtml", () => {
  it("returns HTML containing script path and content", () => {
    const html = scriptToHtml({
      scriptPath: "/home/user/.disk-cleanup/scripts/cleanup-2025.sh",
      scriptContent: "#!/bin/bash\nrm -rf ~/.cache/foo\n",
      shellType: "mac",
    });
    expect(html).toContain("cleanup-2025.sh");
    expect(html).toContain("#!/bin/bash");
    expect(html).toContain("rm -rf");
    expect(html).toContain("language-bash");
    expect(html).toContain("Prism");
  });

  it("uses powershell language for windows shellType", () => {
    const html = scriptToHtml({
      scriptPath: "C:\\Users\\x\\cleanup.ps1",
      scriptContent: "Remove-Item -Recurse $env:TEMP\\foo",
      shellType: "windows",
    });
    expect(html).toContain("language-powershell");
    expect(html).toContain("Remove-Item");
  });
});
