import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const modulesRoot = path.join(repositoryRoot, "modules");
const maximumEffectRadiusPx = 24;
const radialGradientModules = new Set(["radar"]);

function declarationValues(css: string, property: string): string[] {
  const pattern = new RegExp(`(?:^|[;{])\\s*${property}\\s*:\\s*([^;}]+)`, "gi");
  return [...css.matchAll(pattern)].map((match) => match[1]?.trim() ?? "");
}

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    else if (character === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function largestPixelValue(value: string): number {
  const lengths = [...value.matchAll(/-?(?:\d+\.?\d*|\.\d+)px/gi)]
    .map((match) => Math.abs(Number.parseFloat(match[0])));
  return lengths.length === 0 ? 0 : Math.max(...lengths);
}

describe("broadcast visual system", () => {
  it("keeps built-in widget effects restrained", async () => {
    const directories = (await readdir(modulesRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory());

    for (const directory of directories) {
      const cssPath = path.join(modulesRoot, directory.name, "style.css");
      let css: string;
      try {
        css = await readFile(cssPath, "utf8");
      } catch {
        continue;
      }

      if (!radialGradientModules.has(directory.name)) {
        expect(css, `${directory.name} uses an unapproved radial gradient`)
          .not.toMatch(/radial-gradient\s*\(/i);
      }

      for (const property of ["text-shadow", "box-shadow"]) {
        for (const value of declarationValues(css, property)) {
          expect(
            splitTopLevel(value),
            `${directory.name} uses layered ${property}: ${value}`,
          ).toHaveLength(1);
          expect(
            largestPixelValue(value),
            `${directory.name} exceeds the ${maximumEffectRadiusPx}px effect budget: ${value}`,
          ).toBeLessThanOrEqual(maximumEffectRadiusPx);
        }
      }

      for (const value of declarationValues(css, "filter")) {
        expect(value, `${directory.name} uses a blur filter: ${value}`).not.toMatch(/\bblur\s*\(/i);
        expect(
          largestPixelValue(value),
          `${directory.name} exceeds the ${maximumEffectRadiusPx}px filter budget: ${value}`,
        ).toBeLessThanOrEqual(maximumEffectRadiusPx);
      }
    }
  });
});
