import { readFile } from "node:fs/promises";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");

describe("standings sandbox compatibility", () => {
  it("loads an ordered bundle of classic local scripts in the opaque sandbox", async () => {
    const moduleRoot = path.join(root, "modules/standings");
    const html = await readFile(path.join(moduleRoot, "index.html"), "utf8");
    const scriptTags = [...html.matchAll(/<script\s+([^>]*?)src="([^"]+)"([^>]*)><\/script>/gi)];
    const scriptPaths = scriptTags.map((match) => match[2]);

    expect(scriptPaths).toEqual(["windowing.js", "demo-data.js", "module.js"]);
    for (const match of scriptTags) {
      expect(`${match[1]} ${match[3]}`).not.toMatch(/\btype\s*=\s*["']module["']/i);
    }

    const sources = await Promise.all(
      scriptPaths.map((scriptPath) => readFile(path.join(moduleRoot, scriptPath), "utf8")),
    );
    for (const source of sources) {
      expect(source).not.toMatch(/^\s*import\s/m);
      expect(source).not.toMatch(/^\s*export\s/m);
    }

    expect(sources[2]).toContain("window.StandingsWindowing");
    expect(sources[2]).toContain("window.StandingsDemo");
  });

  it("exposes helper APIs without requiring a DOM or Node globals", async () => {
    const browserWindow: Record<string, any> = {};
    const windowing = await readFile(path.join(root, "modules/standings/windowing.js"), "utf8");
    const demoData = await readFile(path.join(root, "modules/standings/demo-data.js"), "utf8");

    runInNewContext(windowing, { window: browserWindow });
    runInNewContext(demoData, { window: browserWindow });

    expect(browserWindow.StandingsWindowing?.selectVisibleStandings).toBeTypeOf("function");
    expect(browserWindow.StandingsWindowing?.selectGroupedStandings).toBeTypeOf("function");
    expect(browserWindow.StandingsDemo?.createDemoPayload).toBeTypeOf("function");
    expect(browserWindow.StandingsDemo.createDemoPayload().standings.entries.length).toBeGreaterThan(0);
  });
});
