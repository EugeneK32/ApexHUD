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

function withoutPreviewOnlyRules(css: string): string {
  let result = css;
  let previous = "";
  while (result !== previous) {
    previous = result;
    result = result.replace(/html\.preview[^{}]*\{[^{}]*\}/gi, "");
  }
  return result;
}

describe("broadcast visual system", () => {
  it("keeps runtime widget effects restrained without policing catalog previews", async () => {
    const directories = (await readdir(modulesRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"));

    for (const directory of directories) {
      const cssPath = path.join(modulesRoot, directory.name, "style.css");
      let css: string;
      try {
        css = await readFile(cssPath, "utf8");
      } catch {
        continue;
      }

      const runtimeCss = withoutPreviewOnlyRules(css);
      if (!radialGradientModules.has(directory.name)) {
        expect(runtimeCss, `${directory.name} uses an unapproved runtime radial gradient`)
          .not.toMatch(/radial-gradient\s*\(/i);
      }

      for (const property of ["text-shadow", "box-shadow"]) {
        for (const value of declarationValues(runtimeCss, property)) {
          expect(
            splitTopLevel(value),
            `${directory.name} uses layered runtime ${property}: ${value}`,
          ).toHaveLength(1);
          expect(
            largestPixelValue(value),
            `${directory.name} exceeds the ${maximumEffectRadiusPx}px runtime effect budget: ${value}`,
          ).toBeLessThanOrEqual(maximumEffectRadiusPx);
        }
      }

      for (const value of declarationValues(runtimeCss, "filter")) {
        expect(value, `${directory.name} uses a runtime blur filter: ${value}`)
          .not.toMatch(/\bblur\s*\(/i);
        expect(
          largestPixelValue(value),
          `${directory.name} exceeds the ${maximumEffectRadiusPx}px runtime filter budget: ${value}`,
        ).toBeLessThanOrEqual(maximumEffectRadiusPx);
      }
    }
  });

  it("keeps decorative preview effects explicitly scoped to preview mode", async () => {
    const directories = (await readdir(modulesRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"));

    for (const directory of directories) {
      const cssPath = path.join(modulesRoot, directory.name, "style.css");
      let css: string;
      try {
        css = await readFile(cssPath, "utf8");
      } catch {
        continue;
      }
      const runtimeCss = withoutPreviewOnlyRules(css);
      const previewOnlyUses = (css.match(/html\.preview[^{}]*\{[^{}]*(?:radial-gradient|box-shadow)[^{}]*\}/gi) ?? []).length;
      if (previewOnlyUses > 0) {
        expect(runtimeCss).not.toContain("0 26px 70px");
      }
    }
  });
});
