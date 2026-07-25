import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createInputsHarness } from "./helpers/inputsHarness";

const root = path.resolve(import.meta.dirname, "../../..");

function traceByColor(
  strokes: ReturnType<typeof createInputsHarness>["context"]["strokes"],
  color: string,
) {
  const matches = strokes.filter(
    (stroke) => stroke.strokeStyle.toLowerCase() === color.toLowerCase() && stroke.globalAlpha > 0.9,
  );
  return matches.at(-1);
}

describe("driver input graph", () => {
  it("keeps clamped 0% and 100% samples inside the canvas", async () => {
    const js = await readFile(path.join(root, "modules/inputs/module.js"), "utf8");
    const css = await readFile(path.join(root, "modules/inputs/style.css"), "utf8");
    const harness = createInputsHarness(js);
    const settings = {
      ...harness.definition.defaults,
      pedalData: "processed",
      showClutch: true,
      showHandbrake: false,
      showGraphs: true,
      graphSeconds: 4,
    };

    harness.definition.applySettings(settings);
    harness.setNow(1_000);
    harness.definition.render(
      { vehicle: { throttle: 0, brake: 1, clutch: -1 } },
      { settings, hasFrame: true, editMode: false, preview: false },
    );

    harness.context.strokes.length = 0;
    harness.setNow(1_040);
    harness.definition.render(
      { vehicle: { throttle: 1, brake: 0, clutch: 2 } },
      { settings, hasFrame: true, editMode: false, preview: false },
    );

    const expected = [
      traceByColor(harness.context.strokes, String(settings.throttleColor)),
      traceByColor(harness.context.strokes, String(settings.brakeColor)),
      traceByColor(harness.context.strokes, String(settings.clutchColor)),
    ];

    for (const trace of expected) {
      expect(trace, "expected a processed pedal trace").toBeDefined();
      expect(trace?.points.length).toBeGreaterThanOrEqual(2);
      for (const [x, y] of trace?.points ?? []) {
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(100);
        expect(y).toBeGreaterThanOrEqual(1);
        expect(y).toBeLessThanOrEqual(99);
      }
    }

    expect(expected[0]?.points.map(([, y]) => y)).toEqual(expect.arrayContaining([99, 1]));
    expect(expected[1]?.points.map(([, y]) => y)).toEqual(expect.arrayContaining([1, 99]));
    expect(expected[2]?.points.map(([, y]) => y)).toEqual(expect.arrayContaining([99, 1]));

    expect(css).toMatch(/\.graph-wrap\s*\{[^}]*overflow:\s*hidden/si);
    expect(css).toMatch(/\.graph-wrap\s+canvas\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/si);
  });

  it("exposes graph history and optional trace controls in the manifest", async () => {
    const manifest = JSON.parse(
      await readFile(path.join(root, "modules/inputs/manifest.json"), "utf8"),
    ) as { settings: Array<{ key: string; min?: number; max?: number }> };
    const settings = new Map(manifest.settings.map((setting) => [setting.key, setting]));

    expect(settings.has("showGraphs")).toBe(true);
    expect(settings.has("showClutch")).toBe(true);
    expect(settings.has("showHandbrake")).toBe(true);
    expect(settings.get("graphSeconds")?.min).toBeGreaterThanOrEqual(1);
    expect(settings.get("graphSeconds")?.max).toBeLessThanOrEqual(12);
    expect(settings.has("graphLineWidth")).toBe(true);
  });
});
