import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const modulesRoot = path.join(repositoryRoot, "modules");

const forbiddenEffects = [
  /radial-gradient\s*\(/i,
  /text-shadow\s*:/i,
  /box-shadow\s*:/i,
  /filter\s*:\s*(?:blur|drop-shadow)\s*\(/i,
  /color-mix\s*\(/i,
];

describe("broadcast visual system", () => {
  it("keeps built-in widgets free of glow-heavy effects", async () => {
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

      for (const effect of forbiddenEffects) {
        expect(css, `${directory.name} contains ${effect}`).not.toMatch(effect);
      }
    }
  });
});
