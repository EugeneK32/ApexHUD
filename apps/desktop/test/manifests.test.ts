import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateModuleManifest, type ModuleManifest } from "@apexhud/protocol";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const modulesRoot = path.join(repositoryRoot, "modules");
const expectedAuthor = "Eugene Konovalov";

const compactMinimumCaps: Record<string, { width: number; height: number }> = {
  dashboard: { width: 280, height: 100 },
  delta: { width: 270, height: 120 },
  fuel: { width: 270, height: 150 },
  incidents: { width: 170, height: 110 },
  inputs: { width: 310, height: 190 },
  "lap-times": { width: 270, height: 150 },
  position: { width: 270, height: 120 },
  "race-control": { width: 310, height: 110 },
  radar: { width: 160, height: 180 },
  session: { width: 310, height: 130 },
  relative: { width: 330, height: 230 },
  standings: { width: 350, height: 230 },
};

async function builtInDirectories() {
  return (await readdir(modulesRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"));
}

async function readManifest(directory: string): Promise<ModuleManifest> {
  return JSON.parse(
    await readFile(path.join(modulesRoot, directory, "manifest.json"), "utf8"),
  ) as ModuleManifest;
}

describe("built-in modules", () => {
  it("have valid manifests and existing entry points", async () => {
    const directories = await builtInDirectories();

    expect(directories.length).toBeGreaterThanOrEqual(2);
    for (const directory of directories) {
      const root = path.join(modulesRoot, directory.name);
      const manifest = await readManifest(directory.name);
      const validation = validateModuleManifest(manifest);
      expect(validation.errors, directory.name).toEqual([]);
      if (!validation.valid) continue;

      const entry = await stat(path.resolve(root, manifest.entry));
      expect(entry.isFile(), `${directory.name}/${manifest.entry}`).toBe(true);
    }
  });

  it("uses unique module ids", async () => {
    const directories = await builtInDirectories();
    const ids = await Promise.all(
      directories.map(async (directory) => (await readManifest(directory.name)).id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("credits the product author consistently", async () => {
    const directories = await builtInDirectories();
    for (const directory of directories) {
      const manifest = await readManifest(directory.name);
      expect(manifest.author, directory.name).toBe(expectedAuthor);
    }
  });

  it("keeps redesigned widgets compact enough for a complete race HUD", async () => {
    const directories = await builtInDirectories();
    for (const directory of directories) {
      const cap = compactMinimumCaps[directory.name];
      if (!cap) continue;

      const manifest = await readManifest(directory.name);
      expect(manifest.minimumSize, `${directory.name} must declare a minimum size`).toBeDefined();
      expect(manifest.minimumSize?.width, `${directory.name} minimum width`)
        .toBeLessThanOrEqual(cap.width);
      expect(manifest.minimumSize?.height, `${directory.name} minimum height`)
        .toBeLessThanOrEqual(cap.height);
      expect(
        manifest.defaultBounds.width * manifest.defaultBounds.height,
        `${directory.name} default footprint`,
      ).toBeLessThanOrEqual(directory.name === "standings" ? 0.14 : 0.11);
    }
  });
});
