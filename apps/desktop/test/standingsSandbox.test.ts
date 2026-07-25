import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");

describe("standings sandbox compatibility", () => {
  it("uses a classic self-contained script inside the opaque sandbox", async () => {
    const html = await readFile(path.join(root, "modules/standings/index.html"), "utf8");
    const js = await readFile(path.join(root, "modules/standings/module.js"), "utf8");
    expect(html).toContain('<script src="module.js"></script>');
    expect(html).not.toContain('type="module"');
    expect(js).not.toMatch(/^\s*import\s/m);
    expect(js).toContain("function selectVisibleStandings");
  });
});
