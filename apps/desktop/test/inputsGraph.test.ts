import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");

describe("driver input graph", () => {
  it("keeps 0% and 100% traces inside the SVG viewBox", async () => {
    const js = await readFile(path.join(root, "modules/inputs/module.js"), "utf8");
    const css = await readFile(path.join(root, "modules/inputs/style.css"), "utf8");
    expect(js).toContain("const y = 97 - clamp(value) * 94");
    expect(css).toMatch(/svg\s*\{[^}]*overflow:\s*hidden/si);
  });
});
