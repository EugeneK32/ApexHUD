import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { runClassicWidget } from "./helpers/widgetHarness";

const root = path.resolve(import.meta.dirname, "../../..");

describe("unlimited session sentinels", () => {
  it("renders semantic OPEN/infinity values instead of raw SDK limits", async () => {
    const moduleSource = await readFile(path.join(root, "modules/session/module.js"), "utf8");
    const harness = runClassicWidget(moduleSource);
    const settings = { ...harness.definition.defaults, primaryMetric: "auto" };
    harness.definition.applySettings(settings);
    harness.definition.render(
      {
        session: {
          sessionType: "Practice",
          sessionName: "Practice",
          trackName: "Test Track",
          timeRemainingSeconds: 604_800,
          hasTimeLimit: false,
          lapsRemaining: 32_767,
          hasLapLimit: false,
          flags: 0,
          isReplayPlaying: false,
        },
        environment: { dataAvailable: false },
      },
      { settings, hasFrame: true },
    );

    expect(harness.elements.get("countdown-value")?.textContent).toBe("OPEN");
    expect(harness.elements.get("secondary-value")?.textContent).toBe("∞");
    expect(harness.elements.get("countdown-value")?.textContent).not.toContain("604800");
    expect(harness.elements.get("secondary-value")?.textContent).not.toContain("32767");
  });

  it("shows a lap-limited open session without fabricating a time", async () => {
    const moduleSource = await readFile(path.join(root, "modules/session/module.js"), "utf8");
    const harness = runClassicWidget(moduleSource);
    const settings = { ...harness.definition.defaults, primaryMetric: "laps" };
    harness.definition.applySettings(settings);
    harness.definition.render(
      {
        session: {
          sessionType: "Race",
          sessionName: "Race",
          trackName: "Test Track",
          timeRemainingSeconds: 0,
          hasTimeLimit: false,
          lapsRemaining: 12,
          hasLapLimit: true,
          flags: 0,
          isReplayPlaying: false,
        },
        environment: { dataAvailable: false },
      },
      { settings, hasFrame: true },
    );

    expect(harness.elements.get("countdown-label")?.textContent).toBe("LAPS REMAINING");
    expect(harness.elements.get("countdown-value")?.textContent).toBe("12");
    expect(harness.elements.get("secondary-value")?.textContent).toBe("OPEN");
  });

  it("normalizes sentinel values in the telemetry processor and fuel engine", async () => {
    const processor = await readFile(
      path.join(root, "services/telemetry/Processing/TelemetryProcessor.cs"),
      "utf8",
    );
    const fuel = await readFile(
      path.join(root, "services/telemetry/Processing/FuelEngine.cs"),
      "utf8",
    );
    expect(processor).toContain("rawLapsRemaining is > 0 and < 32767");
    expect(processor).toContain("rawTimeRemaining < 604799");
    expect(fuel).toContain("frame.SessionLapsRemaining is > 0 and < 32767");
    expect(fuel).toContain("frame.SessionTimeRemaining is > 0 and < 604799");
  });
});
