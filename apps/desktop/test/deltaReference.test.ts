import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runClassicWidget } from "./helpers/widgetHarness";

const root = path.resolve(import.meta.dirname, "../../..");

describe("configurable delta reference", () => {
  it("defaults to the current session best instead of an all-time personal best", async () => {
    const manifest = JSON.parse(
      await readFile(path.join(root, "modules/delta/manifest.json"), "utf8"),
    ) as {
      settings: Array<{
        key: string;
        default: unknown;
        options?: Array<{ label: string; value: string }>;
      }>;
    };
    const reference = manifest.settings.find((setting) => setting.key === "reference");

    expect(reference?.default).toBe("sessionBest");
    expect(reference?.options?.map((option) => option.value)).toEqual([
      "sessionBest",
      "personalBest",
      "optimal",
      "sessionOptimal",
      "lastLap",
    ]);
  });

  it("reads the matching v6 value and availability flag for every reference", async () => {
    const source = await readFile(path.join(root, "modules/delta/module.js"), "utf8");
    const harness = runClassicWidget(source);
    const timing = {
      currentLapSeconds: 61.842,
      lastLapSeconds: 90.418,
      bestLapSeconds: 89.936,
      deltaToBestSeconds: -0.111,
      deltaAvailable: true,
      deltaToOptimalLapSeconds: 0.222,
      deltaToOptimalLapAvailable: true,
      deltaToSessionBestLapSeconds: -0.333,
      deltaToSessionBestLapAvailable: true,
      deltaToSessionOptimalLapSeconds: 0.444,
      deltaToSessionOptimalLapAvailable: true,
      deltaToLastLapSeconds: -0.555,
      deltaToLastLapAvailable: true,
      currentLapValid: true,
      validity: "valid",
    };

    const cases = [
      ["sessionBest", "SESSION BEST", "-0.333"],
      ["personalBest", "PERSONAL BEST", "-0.111"],
      ["optimal", "PERSONAL OPTIMAL", "+0.222"],
      ["sessionOptimal", "SESSION OPTIMAL", "+0.444"],
      ["lastLap", "PREVIOUS LAP", "-0.555"],
    ] as const;

    for (const [reference, label, value] of cases) {
      const settings = { ...harness.definition.defaults, reference, decimals: 3 };
      harness.definition.applySettings(settings);
      harness.definition.render({ timing }, { settings, hasFrame: true });
      expect(harness.elements.get("reference-label")?.textContent).toBe(label);
      expect(harness.elements.get("delta-value")?.textContent).toBe(value);
    }
  });

  it("renders unavailable references as unavailable rather than as a fake zero", async () => {
    const source = await readFile(path.join(root, "modules/delta/module.js"), "utf8");
    const harness = runClassicWidget(source);
    const settings = { ...harness.definition.defaults, reference: "sessionBest" };
    harness.definition.applySettings(settings);
    harness.definition.render(
      {
        timing: {
          deltaToSessionBestLapSeconds: 0,
          deltaToSessionBestLapAvailable: false,
          currentLapValid: true,
          validity: "valid",
        },
      },
      { settings, hasFrame: true },
    );

    expect(harness.elements.get("delta-value")?.textContent).toBe("—");
    expect(harness.elements.get("delta")?.classList.contains("invalid")).toBe(true);
  });
});
