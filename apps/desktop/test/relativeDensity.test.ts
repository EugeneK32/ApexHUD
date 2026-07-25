import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");

describe("relative compact density", () => {
  it("uses fixed-height rows that do not stretch when filtering leaves only a few cars", async () => {
    const css = await readFile(path.join(root, "modules/relative/style.css"), "utf8");
    const moduleSource = await readFile(path.join(root, "modules/relative/module.js"), "utf8");

    expect(css).toMatch(/\.relative-row\s*\{[^}]*flex:\s*0\s+0\s+var\(--row-height\)/si);
    expect(css).toMatch(/\.relative-row\s*\{[^}]*height:\s*var\(--row-height\)/si);
    expect(moduleSource).toContain("availableHeight / Math.max(1, requestedSlots)");
    expect(moduleSource).not.toMatch(/availableHeight\s*\/\s*Math\.max\(1,\s*(?:model\.)?(?:ahead|behind|rowModels)\.length\)/);
  });

  it("reduces the number of rows to fit instead of shrinking typography without limit", async () => {
    const source = await readFile(path.join(root, "modules/relative/module.js"), "utf8");
    expect(source).toContain("Math.floor(Math.max(1, rows.clientHeight) / safeRowHeight)");
    expect(source).toContain("Math.min(wantedRows");
    expect(source).toContain("clampNumber(rowHeight, 20, 38");
  });

  it("keeps the minimum size and row-density controls practical", async () => {
    const manifest = JSON.parse(
      await readFile(path.join(root, "modules/relative/manifest.json"), "utf8"),
    ) as {
      minimumSize: { width: number; height: number };
      settings: Array<{ key: string; min?: number; max?: number; help?: string }>;
    };
    const rowHeight = manifest.settings.find((setting) => setting.key === "rowHeight");

    expect(manifest.minimumSize.width).toBeLessThanOrEqual(240);
    expect(manifest.minimumSize.height).toBeLessThanOrEqual(170);
    expect(rowHeight?.min).toBeGreaterThanOrEqual(18);
    expect(rowHeight?.max).toBeLessThanOrEqual(56);
    expect(rowHeight?.help).toMatch(/never stretch/i);
  });
});
